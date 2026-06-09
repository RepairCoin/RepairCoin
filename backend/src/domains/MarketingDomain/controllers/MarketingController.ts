import { Request, Response, NextFunction } from 'express';
import { MarketingService } from '../../../services/MarketingService';
import { ShopRepository } from '../../../repositories/ShopRepository';
import { ContactRepository } from '../../../repositories/ContactRepository';
import { campaignEmailService } from '../../../services/CampaignEmailService';
import { campaignRewardService, CampaignRewardBlockedError } from '../../../services/CampaignRewardService';
import { logger } from '../../../utils/logger';

export class MarketingController {
  private marketingService: MarketingService;
  private shopRepo: ShopRepository;
  private contactRepo: ContactRepository;

  constructor() {
    this.marketingService = new MarketingService();
    this.shopRepo = new ShopRepository();
    this.contactRepo = new ContactRepository();
  }

  /**
   * Get all campaigns for a shop
   */
  getCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const { page = 1, limit = 10, status } = req.query;

      // Verify shop ownership using shopId from JWT (works for both wallet and social login)
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const campaigns = await this.marketingService.getShopCampaigns(
        shopId,
        { page: Number(page), limit: Number(limit) },
        status as any
      );

      res.json({ success: true, data: campaigns });
    } catch (error: any) {
      logger.error('Error getting campaigns:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get campaigns'
      });
    }
  };

  /**
   * Get a single campaign
   */
  getCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { campaignId } = req.params;

      const campaign = await this.marketingService.getCampaign(campaignId);
      if (!campaign) {
        res.status(404).json({ success: false, error: 'Campaign not found' });
        return;
      }

      // Verify shop ownership using shopId from JWT
      if (!req.user?.shopId || req.user.shopId !== campaign.shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      res.json({ success: true, data: campaign });
    } catch (error: any) {
      logger.error('Error getting campaign:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get campaign'
      });
    }
  };

  /**
   * Create a new campaign
   */
  createCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const {
        name,
        campaignType,
        subject,
        previewText,
        designContent,
        templateId,
        audienceType,
        audienceFilters,
        deliveryMethod,
        promoCodeId,
        couponValue,
        couponType,
        couponExpiresAt,
        serviceId,
        manualEmails
      } = req.body;

      // Verify shop ownership using shopId from JWT (works for both wallet and social login)
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (!name || !campaignType) {
        res.status(400).json({ success: false, error: 'Name and campaign type are required' });
        return;
      }

      // Process manual emails if provided
      let processedManualEmails: string[] = [];
      if (manualEmails && typeof manualEmails === 'string' && manualEmails.trim()) {
        // Parse emails from the string (split by newline or comma, trim, validate)
        const emailList = manualEmails
          .split(/[\n,]+/)
          .map(email => email.trim().toLowerCase())
          .filter(email => email && email.includes('@'));

        // Create contacts for emails that don't exist
        for (const email of emailList) {
          try {
            // Extract name from email (part before @) or use generic name
            const emailPrefix = email.split('@')[0];
            const fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

            await this.contactRepo.createContact({
              shopId,
              fullName,
              email,
              source: 'manual',
              tags: ['campaign-invite']
            });
          } catch (error: unknown) {
            // Contact already exists or validation error - continue
            if (error && typeof error === 'object' && 'message' in error) {
              const errorMessage = (error as { message: string }).message;
              // Only log if it's not a duplicate error
              if (!errorMessage.includes('already exists')) {
                logger.warn(`Error creating contact for ${email}:`, errorMessage);
              }
            }
          }
        }

        processedManualEmails = emailList;
      }

      // Merge manual emails into audienceFilters
      const updatedAudienceFilters = {
        ...audienceFilters,
        ...(processedManualEmails.length > 0 && { manualEmails: processedManualEmails })
      };

      const campaign = await this.marketingService.createCampaign({
        shopId,
        name,
        campaignType,
        subject,
        previewText,
        designContent,
        templateId,
        audienceType,
        audienceFilters: updatedAudienceFilters,
        deliveryMethod,
        promoCodeId,
        couponValue,
        couponType,
        couponExpiresAt: couponExpiresAt ? new Date(couponExpiresAt) : undefined,
        serviceId
      });

      res.status(201).json({
        success: true,
        data: campaign,
        meta: processedManualEmails.length > 0
          ? { manualEmailsAdded: processedManualEmails.length }
          : undefined
      });
    } catch (error: unknown) {
      logger.error('Error creating campaign:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        res.status(500).json({
          success: false,
          error: (error as { message: string }).message || 'Failed to create campaign'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create campaign'
        });
      }
    }
  };

  /**
   * Update a campaign
   */
  updateCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { campaignId } = req.params;

      // Get existing campaign
      const existing = await this.marketingService.getCampaign(campaignId);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Campaign not found' });
        return;
      }

      // Verify shop ownership using shopId from JWT
      if (!req.user?.shopId || req.user.shopId !== existing.shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (existing.status === 'sent') {
        res.status(400).json({ success: false, error: 'Cannot update a sent campaign' });
        return;
      }

      const {
        name,
        subject,
        previewText,
        designContent,
        templateId,
        audienceType,
        audienceFilters,
        deliveryMethod,
        promoCodeId,
        couponValue,
        couponType,
        couponExpiresAt,
        serviceId
      } = req.body;

      const campaign = await this.marketingService.updateCampaign(campaignId, {
        name,
        subject,
        previewText,
        designContent,
        templateId,
        audienceType,
        audienceFilters,
        deliveryMethod,
        promoCodeId,
        couponValue,
        couponType,
        couponExpiresAt: couponExpiresAt ? new Date(couponExpiresAt) : undefined,
        serviceId
      });

      res.json({ success: true, data: campaign });
    } catch (error: any) {
      logger.error('Error updating campaign:', error);
      // Return a more descriptive error message
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update campaign'
      });
    }
  };

  /**
   * Delete a campaign
   */
  deleteCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { campaignId } = req.params;

      const existing = await this.marketingService.getCampaign(campaignId);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Campaign not found' });
        return;
      }

      // Verify shop ownership using shopId from JWT
      if (!req.user?.shopId || req.user.shopId !== existing.shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (existing.status === 'sent') {
        res.status(400).json({ success: false, error: 'Cannot delete a sent campaign' });
        return;
      }

      await this.marketingService.deleteCampaign(campaignId);

      res.json({ success: true, message: 'Campaign deleted' });
    } catch (error: any) {
      logger.error('Error deleting campaign:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete campaign'
      });
    }
  };

  /**
   * Send a campaign immediately
   */
  sendCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { campaignId } = req.params;

      const existing = await this.marketingService.getCampaign(campaignId);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Campaign not found' });
        return;
      }

      // Verify shop ownership using shopId from JWT
      if (!req.user?.shopId || req.user.shopId !== existing.shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (existing.status === 'sent') {
        res.status(400).json({ success: false, error: 'Campaign has already been sent' });
        return;
      }

      // Fetch shop data for campaign delivery (email, name)
      const shop = await this.shopRepo.getShop(existing.shopId);
      const result = await this.marketingService.sendCampaign(campaignId, {
        id: existing.shopId,
        name: shop?.name || 'Shop',
        email: shop?.email || '',
        walletAddress: shop?.walletAddress || ''
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      // Insufficient RCN for the campaign's reward — block the send with a 400
      // and the shortfall details so the UI can say "buy more RCN / lower it".
      if (error instanceof CampaignRewardBlockedError) {
        res.status(400).json({ success: false, error: error.message, details: error.details });
        return;
      }
      logger.error('Error sending campaign:', error);
      // Return a more descriptive error message
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send campaign'
      });
    }
  };

  /**
   * Retry a campaign's failed RCN rewards (Campaign Rewards — Phase 1).
   * Idempotent — only re-issues recipients still in 'failed'.
   */
  retryRewards = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const existing = await this.marketingService.getCampaign(campaignId);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Campaign not found' });
        return;
      }
      if (!req.user?.shopId || req.user.shopId !== existing.shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      const result = await campaignRewardService.retryFailed(existing);
      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof CampaignRewardBlockedError) {
        res.status(400).json({ success: false, error: error.message, details: error.details });
        return;
      }
      logger.error('Error retrying campaign rewards:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to retry rewards' });
    }
  };

  /**
   * Schedule a campaign
   */
  scheduleCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const { scheduledAt } = req.body;

      if (!scheduledAt) {
        res.status(400).json({ success: false, error: 'scheduledAt is required' });
        return;
      }

      const existing = await this.marketingService.getCampaign(campaignId);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Campaign not found' });
        return;
      }

      // Verify shop ownership using shopId from JWT
      if (!req.user?.shopId || req.user.shopId !== existing.shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const campaign = await this.marketingService.scheduleCampaign(campaignId, new Date(scheduledAt));

      res.json({ success: true, data: campaign });
    } catch (error: any) {
      logger.error('Error scheduling campaign:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to schedule campaign'
      });
    }
  };

  /**
   * Cancel a scheduled campaign
   */
  cancelCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { campaignId } = req.params;

      const existing = await this.marketingService.getCampaign(campaignId);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Campaign not found' });
        return;
      }

      // Verify shop ownership using shopId from JWT
      if (!req.user?.shopId || req.user.shopId !== existing.shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const campaign = await this.marketingService.cancelCampaign(campaignId);

      res.json({ success: true, data: campaign });
    } catch (error: any) {
      logger.error('Error cancelling campaign:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel campaign'
      });
    }
  };

  /**
   * Get campaign statistics for a shop
   */
  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;

      // Verify shop ownership using shopId from JWT (works for both wallet and social login)
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const stats = await this.marketingService.getCampaignStats(shopId);

      res.json({ success: true, data: stats });
    } catch (error: any) {
      logger.error('Error getting campaign stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get campaign stats'
      });
    }
  };

  /**
   * Get audience count for targeting
   */
  getAudienceCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const { audienceType, audienceFilters } = req.query;

      // Verify shop ownership using shopId from JWT (works for both wallet and social login)
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const count = await this.marketingService.getAudienceCount(
        shopId,
        (audienceType as any) || 'all_customers',
        audienceFilters ? JSON.parse(audienceFilters as string) : undefined
      );

      res.json({ success: true, data: { count } });
    } catch (error: any) {
      logger.error('Error getting audience count:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get audience count'
      });
    }
  };

  /**
   * Get shop customers with pagination and search
   * Used for "select customers" audience option
   */
  getShopCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const { page = 1, limit = 10, search } = req.query;

      // Verify shop ownership using shopId from JWT (works for both wallet and social login)
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const result = await this.marketingService.getShopCustomers(shopId, {
        page: Number(page),
        limit: Number(limit),
        search: search as string | undefined
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error getting shop customers:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get shop customers'
      });
    }
  };

  /**
   * Get available templates
   */
  getTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { category } = req.query;

      const templates = await this.marketingService.getTemplates(category as string);

      res.json({ success: true, data: templates });
    } catch (error: any) {
      logger.error('Error getting templates:', error);
      next(error);
    }
  };

  /**
   * Get a specific template
   */
  getTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { templateId } = req.params;

      const template = await this.marketingService.getTemplate(templateId);
      if (!template) {
        res.status(404).json({ success: false, error: 'Template not found' });
        return;
      }

      res.json({ success: true, data: template });
    } catch (error: any) {
      logger.error('Error getting template:', error);
      next(error);
    }
  };

  // ==================== CONTACT MANAGEMENT ====================

  /**
   * Get imported contacts for a shop
   */
  getContacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const { page = 1, limit = 50, status, search } = req.query;

      // Verify shop ownership
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const result = await this.contactRepo.getContacts(shopId, {
        page: Number(page),
        limit: Number(limit),
        status: status as string | undefined,
        search: search as string | undefined
      });

      res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('Error getting contacts:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        res.status(500).json({ success: false, error: (error as { message: string }).message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to get contacts' });
      }
    }
  };

  /**
   * Create a new contact
   */
  createContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const { fullName, email, phone, tags, notes } = req.body;

      // Verify shop ownership
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (!fullName) {
        res.status(400).json({ success: false, error: 'Full name is required' });
        return;
      }

      if (!email && !phone) {
        res.status(400).json({ success: false, error: 'At least one contact method (email or phone) is required' });
        return;
      }

      const contact = await this.contactRepo.createContact({
        shopId,
        fullName,
        email,
        phone,
        source: 'manual',
        tags,
        notes
      });

      res.status(201).json({ success: true, data: contact });
    } catch (error: unknown) {
      logger.error('Error creating contact:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        res.status(500).json({ success: false, error: (error as { message: string }).message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to create contact' });
      }
    }
  };

  /**
   * Bulk import contacts from CSV
   */
  importContacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const { contacts } = req.body;

      // Verify shop ownership
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (!Array.isArray(contacts) || contacts.length === 0) {
        res.status(400).json({ success: false, error: 'Contacts array is required and cannot be empty' });
        return;
      }

      // Add shopId to each contact
      const contactsWithShop = contacts.map(c => ({
        shopId,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        source: 'csv' as const,
        tags: c.tags || []
      }));

      const result = await this.contactRepo.bulkCreateContacts(contactsWithShop);

      res.json({
        success: true,
        data: {
          created: result.created,
          failed: result.errors.length,
          errors: result.errors
        }
      });
    } catch (error: unknown) {
      logger.error('Error importing contacts:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        res.status(500).json({ success: false, error: (error as { message: string }).message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to import contacts' });
      }
    }
  };

  /**
   * Get contact statistics
   */
  getContactStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;

      // Verify shop ownership
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const stats = await this.contactRepo.getContactStats(shopId);

      res.json({ success: true, data: stats });
    } catch (error: unknown) {
      logger.error('Error getting contact stats:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        res.status(500).json({ success: false, error: (error as { message: string }).message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to get contact stats' });
      }
    }
  };

  /**
   * Update a contact
   */
  updateContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { contactId } = req.params;
      const { fullName, email, phone, status, tags, notes } = req.body;

      // Get contact to verify shop ownership
      const contact = await this.contactRepo.getContactById(contactId);

      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== contact.shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const updated = await this.contactRepo.updateContact(contactId, {
        fullName,
        email,
        phone,
        status,
        tags,
        notes
      });

      res.json({ success: true, data: updated });
    } catch (error: unknown) {
      logger.error('Error updating contact:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message: string }).message;
        if (message === 'Contact not found') {
          res.status(404).json({ success: false, error: message });
          return;
        }
        res.status(500).json({ success: false, error: message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to update contact' });
      }
    }
  };

  /**
   * Delete a contact
   */
  deleteContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { contactId } = req.params;

      // Get contact to verify shop ownership
      const contact = await this.contactRepo.getContactById(contactId);

      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== contact.shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      await this.contactRepo.deleteContact(contactId);

      res.json({ success: true, message: 'Contact deleted successfully' });
    } catch (error: unknown) {
      logger.error('Error deleting contact:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message: string }).message;
        if (message === 'Contact not found') {
          res.status(404).json({ success: false, error: message });
          return;
        }
        res.status(500).json({ success: false, error: message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to delete contact' });
      }
    }
  };

  /**
   * Send email campaign to imported contacts
   */
  sendContactEmailCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const { subject, htmlContent, contactIds } = req.body;

      // Verify shop ownership
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      // Validate inputs
      if (!subject || !htmlContent) {
        res.status(400).json({ success: false, error: 'Subject and HTML content are required' });
        return;
      }

      // Check if SendGrid is configured
      if (!campaignEmailService.isReady()) {
        res.status(500).json({
          success: false,
          error: 'Email service is not configured. Please set SENDGRID_API_KEY in environment variables.'
        });
        return;
      }

      // Get contacts to send to
      let contacts;
      if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
        // Send to specific contacts
        contacts = await this.contactRepo.getContactsByIds(contactIds);
      } else {
        // Send to all active contacts
        contacts = await this.contactRepo.getActiveContacts(shopId);
      }

      // Filter contacts with valid email addresses
      const emailRecipients = contacts
        .filter(c => c.email && c.status === 'active')
        .map(c => ({
          email: c.email!,
          fullName: c.fullName,
          contactId: c.id
        }));

      if (emailRecipients.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No valid email recipients found'
        });
        return;
      }

      // Send bulk emails
      const results = await campaignEmailService.sendBulkCampaignEmails({
        subject,
        htmlContent,
        recipients: emailRecipients
      });

      // Update contact send counts
      const sentContactIds = results
        .filter(r => r.status === 'sent')
        .map(r => r.contactId);

      if (sentContactIds.length > 0) {
        await this.contactRepo.incrementEmailSentCount(sentContactIds);
      }

      const successCount = results.filter(r => r.status === 'sent').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      res.json({
        success: true,
        data: {
          totalRecipients: emailRecipients.length,
          sent: successCount,
          failed: failedCount,
          results
        }
      });
    } catch (error: unknown) {
      logger.error('Error sending contact email campaign:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        res.status(500).json({ success: false, error: (error as { message: string }).message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to send email campaign' });
      }
    }
  };

  /**
   * Send test email to shop owner
   */
  sendTestEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const { subject, htmlContent, testEmail } = req.body;

      // Verify shop ownership
      const userShopId = req.user?.shopId;
      if (!userShopId || userShopId !== shopId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      // Validate inputs
      if (!subject || !htmlContent) {
        res.status(400).json({ success: false, error: 'Subject and HTML content are required' });
        return;
      }

      if (!testEmail) {
        res.status(400).json({ success: false, error: 'Test email address is required' });
        return;
      }

      // Check if SendGrid is configured
      if (!campaignEmailService.isReady()) {
        res.status(500).json({
          success: false,
          error: 'Email service is not configured. Please set SENDGRID_API_KEY in environment variables.'
        });
        return;
      }

      // Send test email
      const result = await campaignEmailService.sendTestEmail(
        testEmail,
        subject,
        htmlContent
      );

      if (result.success) {
        res.json({
          success: true,
          message: `Test email sent successfully to ${testEmail}`
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send test email'
        });
      }
    } catch (error: unknown) {
      logger.error('Error sending test email:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        res.status(500).json({ success: false, error: (error as { message: string }).message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to send test email' });
      }
    }
  };
}
