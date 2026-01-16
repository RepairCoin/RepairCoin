import { Request, Response, NextFunction } from 'express';
import { MarketingService } from '../../../services/MarketingService';
import { ShopRepository } from '../../../repositories/ShopRepository';
import { logger } from '../../../utils/logger';

export class MarketingController {
  private marketingService: MarketingService;
  private shopRepo: ShopRepository;

  constructor() {
    this.marketingService = new MarketingService();
    this.shopRepo = new ShopRepository();
  }

  /**
   * Get all campaigns for a shop
   */
  getCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const { page = 1, limit = 10, status } = req.query;

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
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

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(campaign.shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
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
        serviceId
      } = req.body;

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (!name || !campaignType) {
        res.status(400).json({ success: false, error: 'Name and campaign type are required' });
        return;
      }

      const campaign = await this.marketingService.createCampaign({
        shopId,
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
        couponExpiresAt: couponExpiresAt ? new Date(couponExpiresAt) : undefined,
        serviceId
      });

      res.status(201).json({ success: true, data: campaign });
    } catch (error: any) {
      logger.error('Error creating campaign:', error);
      // Return a more descriptive error message
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create campaign'
      });
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

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(existing.shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
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

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(existing.shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
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

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(existing.shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (existing.status === 'sent') {
        res.status(400).json({ success: false, error: 'Campaign has already been sent' });
        return;
      }

      const result = await this.marketingService.sendCampaign(campaignId, {
        id: shop.shopId,
        name: shop.name,
        email: shop.email,
        walletAddress: shop.walletAddress
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error sending campaign:', error);
      // Return a more descriptive error message
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send campaign'
      });
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

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(existing.shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
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

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(existing.shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
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

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
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

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
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

      // Verify shop ownership
      const shop = await this.shopRepo.getShop(shopId);
      if (!shop) {
        res.status(404).json({ success: false, error: 'Shop not found' });
        return;
      }

      if (!shop.walletAddress || shop.walletAddress.toLowerCase() !== req.user?.address?.toLowerCase()) {
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
}
