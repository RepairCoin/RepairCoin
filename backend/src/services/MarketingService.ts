import { logger } from '../utils/logger';
import {
  MarketingCampaignRepository,
  MarketingCampaign,
  CreateCampaignParams,
  UpdateCampaignParams,
  MarketingTemplate
} from '../repositories/MarketingCampaignRepository';
import { NotificationRepository, CreateNotificationParams } from '../repositories/NotificationRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { EmailService } from './EmailService';
import { WebSocketManager } from './WebSocketManager';
import { PaginatedResult, PaginationParams } from '../repositories/BaseRepository';

interface ShopInfo {
  id: string;
  name: string;
  email?: string;
  walletAddress: string;
}

interface ServiceData {
  serviceId: string;
  serviceName: string;
  priceUsd: number;
  imageUrl?: string;
  description?: string;
}

export interface CampaignDeliveryResult {
  totalRecipients: number;
  emailsSent: number;
  emailsFailed: number;
  inAppSent: number;
  inAppFailed: number;
}

export class MarketingService {
  private campaignRepo: MarketingCampaignRepository;
  private notificationRepo: NotificationRepository;
  private customerRepo: CustomerRepository;
  private serviceRepo: ServiceRepository;
  private emailService: EmailService;
  private wsManager: WebSocketManager | null;

  constructor(wsManager?: WebSocketManager) {
    this.campaignRepo = new MarketingCampaignRepository();
    this.notificationRepo = new NotificationRepository();
    this.customerRepo = new CustomerRepository();
    this.serviceRepo = new ServiceRepository();
    this.emailService = new EmailService();
    this.wsManager = wsManager || null;
  }

  // Campaign CRUD
  async createCampaign(params: CreateCampaignParams): Promise<MarketingCampaign> {
    logger.info(`Creating marketing campaign for shop ${params.shopId}`, { name: params.name });
    return this.campaignRepo.create(params);
  }

  async getCampaign(id: string): Promise<MarketingCampaign | null> {
    return this.campaignRepo.findById(id);
  }

  async getShopCampaigns(
    shopId: string,
    pagination: PaginationParams,
    status?: MarketingCampaign['status']
  ): Promise<PaginatedResult<MarketingCampaign>> {
    return this.campaignRepo.findByShop(shopId, pagination, status);
  }

  async updateCampaign(id: string, params: UpdateCampaignParams): Promise<MarketingCampaign> {
    logger.info(`Updating marketing campaign ${id}`);
    return this.campaignRepo.update(id, params);
  }

  async deleteCampaign(id: string): Promise<boolean> {
    logger.info(`Deleting marketing campaign ${id}`);
    return this.campaignRepo.delete(id);
  }

  // Templates
  async getTemplates(category?: string): Promise<MarketingTemplate[]> {
    return this.campaignRepo.getTemplates(category);
  }

  async getTemplate(id: string): Promise<MarketingTemplate | null> {
    return this.campaignRepo.getTemplateById(id);
  }

  // Statistics
  async getCampaignStats(shopId: string) {
    return this.campaignRepo.getCampaignStats(shopId);
  }

  // Get audience count for targeting
  async getAudienceCount(
    shopId: string,
    audienceType: MarketingCampaign['audienceType'],
    audienceFilters?: Record<string, any>
  ): Promise<number> {
    const recipients = await this.getTargetAudience(shopId, audienceType, audienceFilters);
    return recipients.length;
  }

  // Get shop customers with pagination and search for "select customers" audience option
  async getShopCustomers(
    shopId: string,
    options: { page: number; limit: number; search?: string }
  ) {
    return this.customerRepo.findByShopInteractionPaginated(shopId, options);
  }

  // Send campaign
  async sendCampaign(
    campaignId: string,
    shopInfo: ShopInfo
  ): Promise<CampaignDeliveryResult> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'sent') {
      throw new Error('Campaign has already been sent');
    }

    logger.info(`Sending marketing campaign ${campaignId}`, {
      name: campaign.name,
      deliveryMethod: campaign.deliveryMethod,
      audienceType: campaign.audienceType
    });

    // Get target audience
    const recipients = await this.getTargetAudience(
      campaign.shopId,
      campaign.audienceType,
      campaign.audienceFilters
    );

    if (recipients.length === 0) {
      throw new Error('No recipients found for this campaign');
    }

    // Add recipients to tracking table
    await this.campaignRepo.addRecipients(
      campaignId,
      recipients.map(r => ({ customerAddress: r.walletAddress, customerEmail: r.email }))
    );

    const result: CampaignDeliveryResult = {
      totalRecipients: recipients.length,
      emailsSent: 0,
      emailsFailed: 0,
      inAppSent: 0,
      inAppFailed: 0
    };

    // Send via selected delivery method
    for (const recipient of recipients) {
      try {
        if (campaign.deliveryMethod === 'email' || campaign.deliveryMethod === 'both') {
          if (recipient.email) {
            const emailSent = await this.sendEmailCampaign(campaign, recipient, shopInfo);
            if (emailSent) {
              result.emailsSent++;
              await this.campaignRepo.updateRecipientStatus(campaignId, recipient.walletAddress, {
                emailSentAt: new Date()
              });
            } else {
              result.emailsFailed++;
            }
          }
        }

        if (campaign.deliveryMethod === 'in_app' || campaign.deliveryMethod === 'both') {
          const inAppSent = await this.sendInAppNotification(campaign, recipient, shopInfo);
          if (inAppSent) {
            result.inAppSent++;
            await this.campaignRepo.updateRecipientStatus(campaignId, recipient.walletAddress, {
              inAppSentAt: new Date()
            });
          } else {
            result.inAppFailed++;
          }
        }
      } catch (error: any) {
        logger.error(`Error sending campaign to ${recipient.walletAddress}:`, error);
        await this.campaignRepo.updateRecipientStatus(campaignId, recipient.walletAddress, {
          deliveryError: error.message
        });
      }
    }

    // Update campaign status and stats
    await this.campaignRepo.markAsSent(campaignId);
    await this.campaignRepo.updateStats(campaignId, {
      totalRecipients: result.totalRecipients,
      emailsSent: result.emailsSent,
      inAppSent: result.inAppSent
    });

    logger.info(`Campaign ${campaignId} sent successfully`, result);

    return result;
  }

  // Schedule campaign
  async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<MarketingCampaign> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (scheduledAt <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    return this.campaignRepo.update(campaignId, {
      status: 'scheduled',
      scheduledAt
    });
  }

  // Cancel scheduled campaign
  async cancelCampaign(campaignId: string): Promise<MarketingCampaign> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'sent') {
      throw new Error('Cannot cancel a campaign that has already been sent');
    }

    return this.campaignRepo.update(campaignId, {
      status: 'cancelled',
      scheduledAt: null
    });
  }

  // Process scheduled campaigns (call this from a cron job)
  async processScheduledCampaigns(): Promise<void> {
    const campaigns = await this.campaignRepo.getScheduledCampaigns();

    for (const campaign of campaigns) {
      try {
        // Get shop info for sending
        // Note: You'll need to fetch shop info from ShopRepository
        const shopInfo: ShopInfo = {
          id: campaign.shopId,
          name: 'Shop', // Would be fetched from DB
          walletAddress: '' // Would be fetched from DB
        };

        await this.sendCampaign(campaign.id, shopInfo);
        logger.info(`Scheduled campaign ${campaign.id} sent successfully`);
      } catch (error: any) {
        logger.error(`Error processing scheduled campaign ${campaign.id}:`, error);
      }
    }
  }

  // Private methods
  private async getTargetAudience(
    shopId: string,
    audienceType: MarketingCampaign['audienceType'],
    audienceFilters?: Record<string, any>
  ): Promise<Array<{ walletAddress: string; email?: string; name?: string }>> {
    // Get all customers who have interacted with this shop
    const shopCustomers = await this.customerRepo.findByShopInteraction(shopId);

    switch (audienceType) {
      case 'all_customers':
        return shopCustomers;

      case 'top_spenders':
        // Filter by total spent (top 20%)
        const sortedBySpent = shopCustomers.sort((a, b) =>
          (b.totalSpent || 0) - (a.totalSpent || 0)
        );
        const topCount = Math.max(1, Math.ceil(sortedBySpent.length * 0.2));
        return sortedBySpent.slice(0, topCount);

      case 'frequent_visitors':
        // Filter by visit count (top 20%)
        const sortedByVisits = shopCustomers.sort((a, b) =>
          (b.visitCount || 0) - (a.visitCount || 0)
        );
        const frequentCount = Math.max(1, Math.ceil(sortedByVisits.length * 0.2));
        return sortedByVisits.slice(0, frequentCount);

      case 'active_customers':
        // Customers who visited in the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return shopCustomers.filter(c =>
          c.lastVisit && new Date(c.lastVisit) >= thirtyDaysAgo
        );

      case 'select_customers':
        // Filter to only include selected customer addresses
        if (audienceFilters?.selectedAddresses && Array.isArray(audienceFilters.selectedAddresses)) {
          const selectedSet = new Set(
            audienceFilters.selectedAddresses.map((addr: string) => addr.toLowerCase())
          );
          return shopCustomers.filter(c => selectedSet.has(c.walletAddress.toLowerCase()));
        }
        return [];

      case 'custom':
        // Apply custom filters from audienceFilters
        let filtered = shopCustomers;

        if (audienceFilters?.minSpent) {
          filtered = filtered.filter(c => (c.totalSpent || 0) >= audienceFilters.minSpent);
        }
        if (audienceFilters?.minVisits) {
          filtered = filtered.filter(c => (c.visitCount || 0) >= audienceFilters.minVisits);
        }
        if (audienceFilters?.tier) {
          filtered = filtered.filter(c => c.tier === audienceFilters.tier);
        }
        if (audienceFilters?.lastVisitDays) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - audienceFilters.lastVisitDays);
          filtered = filtered.filter(c =>
            c.lastVisit && new Date(c.lastVisit) >= cutoffDate
          );
        }

        return filtered;

      default:
        return shopCustomers;
    }
  }

  private async sendEmailCampaign(
    campaign: MarketingCampaign,
    recipient: { walletAddress: string; email?: string; name?: string },
    shopInfo: ShopInfo
  ): Promise<boolean> {
    if (!recipient.email) {
      return false;
    }

    // Fetch service data if serviceId is set
    let serviceData: ServiceData | undefined;
    if (campaign.serviceId) {
      try {
        const service = await this.serviceRepo.getServiceById(campaign.serviceId);
        if (service) {
          serviceData = {
            serviceId: service.serviceId,
            serviceName: service.serviceName,
            priceUsd: service.priceUsd,
            imageUrl: service.imageUrl,
            description: service.description
          };
        }
      } catch (error) {
        logger.warn('Failed to fetch service data for email:', error);
      }
    }

    const html = this.renderEmailTemplate(campaign, shopInfo, recipient.name, serviceData);

    try {
      const sent = await this.emailService.sendMarketingEmail({
        to: recipient.email,
        subject: campaign.subject || `Message from ${shopInfo.name}`,
        html,
        campaignId: campaign.id
      });
      return sent;
    } catch (error) {
      logger.error('Error sending marketing email:', error);
      return false;
    }
  }

  private async sendInAppNotification(
    campaign: MarketingCampaign,
    recipient: { walletAddress: string; email?: string; name?: string },
    shopInfo: ShopInfo
  ): Promise<boolean> {
    try {
      // Create notification in database
      const notificationParams: CreateNotificationParams = {
        senderAddress: shopInfo.walletAddress,
        receiverAddress: recipient.walletAddress,
        notificationType: 'marketing_campaign',
        message: this.generateNotificationMessage(campaign, shopInfo),
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignType: campaign.campaignType,
          shopId: shopInfo.id,
          shopName: shopInfo.name,
          couponValue: campaign.couponValue,
          couponType: campaign.couponType,
          couponExpiresAt: campaign.couponExpiresAt?.toISOString(),
          serviceId: campaign.serviceId,
          designContent: campaign.designContent
        }
      };

      const notification = await this.notificationRepo.create(notificationParams);

      // Send via WebSocket if available
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(recipient.walletAddress, notification);
      }

      return true;
    } catch (error) {
      logger.error('Error sending in-app notification:', error);
      return false;
    }
  }

  private generateNotificationMessage(campaign: MarketingCampaign, shopInfo: ShopInfo): string {
    switch (campaign.campaignType) {
      case 'offer_coupon':
        // Only show coupon details if couponValue exists
        if (campaign.couponValue) {
          if (campaign.couponType === 'percentage') {
            return `${shopInfo.name} is offering you ${campaign.couponValue}% off your next visit!`;
          } else {
            return `${shopInfo.name} is offering you $${campaign.couponValue} off your next visit!`;
          }
        }
        // Fallback if no coupon value
        return `${shopInfo.name} has a special offer for you!`;

      case 'announce_service':
        return `${shopInfo.name} has announced a new service. Check it out!`;

      case 'newsletter':
        return `New update from ${shopInfo.name}: ${campaign.subject || campaign.name}`;

      default:
        return campaign.subject || `Message from ${shopInfo.name}`;
    }
  }

  private renderEmailTemplate(
    campaign: MarketingCampaign,
    shopInfo: ShopInfo,
    _recipientName?: string,
    serviceData?: ServiceData
  ): string {
    const design = campaign.designContent;
    const frontendUrl = process.env.FRONTEND_URL || 'https://repaircoin.ai';
    // Always use production URL for logo in emails (localhost won't work for email recipients)
    const logoUrl = 'https://repaircoin.ai/img/landing/repaircoin-icon.png';

    // Build HTML from design blocks
    let blocksHtml = '';

    if (design.blocks && Array.isArray(design.blocks)) {
      for (const block of design.blocks) {
        blocksHtml += this.renderBlock(block, campaign, shopInfo, serviceData);
      }
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${campaign.subject || campaign.name}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
          <tr>
            <td align="center" style="padding: 20px;">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                ${design.header?.enabled !== false ? `
                <tr>
                  <td style="background-color: ${design.header?.backgroundColor || '#1a1a2e'}; padding: 30px; text-align: center;">
                    ${design.header?.showLogo !== false ? `
                      <img src="${logoUrl}" alt="RepairCoin" style="width: 60px; height: 60px; margin: 0 auto 15px; display: block;">
                    ` : ''}
                    <h1 style="color: white; margin: 0; font-size: 24px;">${shopInfo.name}</h1>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 30px;">
                    ${blocksHtml}
                  </td>
                </tr>
                ${design.footer?.showSocial || design.footer?.showUnsubscribe ? `
                <tr>
                  <td style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                    ${design.footer?.showSocial ? `
                      <div style="margin-bottom: 15px;">
                        <a href="#" style="color: #666; margin: 0 10px; text-decoration: none;">Website</a>
                        <a href="#" style="color: #666; margin: 0 10px; text-decoration: none;">Instagram</a>
                        <a href="#" style="color: #666; margin: 0 10px; text-decoration: none;">Facebook</a>
                      </div>
                    ` : ''}
                    ${design.footer?.showUnsubscribe ? `
                      <p style="color: #999; font-size: 12px; margin: 0;">
                        You received this email because you are a customer of ${shopInfo.name}.
                        <br><a href="#" style="color: #999;">Unsubscribe</a>
                      </p>
                    ` : ''}
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private renderBlock(block: any, campaign: MarketingCampaign, _shopInfo: ShopInfo, serviceData?: ServiceData): string {
    const style = block.style || {};
    const frontendUrl = process.env.FRONTEND_URL || 'https://repaircoin.ai';

    switch (block.type) {
      case 'headline':
        return `
          <h2 style="
            font-size: ${style.fontSize || '24px'};
            font-weight: ${style.fontWeight || 'bold'};
            text-align: ${style.textAlign || 'center'};
            color: ${style.color || '#333'};
            margin: 0 0 20px 0;
          ">${block.content}</h2>
        `;

      case 'text':
        return `
          <p style="
            font-size: ${style.fontSize || '14px'};
            text-align: ${style.textAlign || 'left'};
            color: ${style.color || '#666'};
            line-height: 1.6;
            margin: 0 0 20px 0;
          ">${block.content}</p>
        `;

      case 'button':
        // Generate proper link based on service or shop
        let buttonUrl = `${frontendUrl}/customer?tab=marketplace`;
        if (serviceData?.serviceId) {
          buttonUrl = `${frontendUrl}/customer?tab=marketplace&service=${serviceData.serviceId}`;
        } else if (campaign.serviceId) {
          buttonUrl = `${frontendUrl}/customer?tab=marketplace&service=${campaign.serviceId}`;
        }

        return `
          <div style="text-align: center; margin: 20px 0;">
            <a href="${buttonUrl}" style="
              display: inline-block;
              background-color: ${style.backgroundColor || '#eab308'};
              color: ${style.textColor || '#000'};
              padding: 12px 30px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: bold;
              font-size: 14px;
            ">${block.content}</a>
          </div>
        `;

      case 'coupon':
        if (!campaign.couponValue) return '';
        const couponDisplay = campaign.couponType === 'percentage'
          ? `${campaign.couponValue}%`
          : `$${campaign.couponValue}`;
        const expiryText = campaign.couponExpiresAt
          ? `Expires: ${campaign.couponExpiresAt.toLocaleDateString()}`
          : '';

        return `
          <div style="
            background-color: ${style.backgroundColor || '#10B981'};
            color: ${style.textColor || 'white'};
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
          ">
            <div style="font-size: 48px; font-weight: bold; margin-bottom: 10px;">
              ${couponDisplay}
            </div>
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
              OFF your next visit!
            </div>
            ${expiryText ? `<div style="font-size: 12px; opacity: 0.8; margin-top: 15px;">${expiryText}</div>` : ''}
          </div>
        `;

      case 'service_card':
        // If we have actual service data, show the real service card
        if (serviceData) {
          const serviceUrl = `${frontendUrl}/customer?tab=marketplace&service=${serviceData.serviceId}`;
          return `
            <div style="
              border-radius: 12px;
              overflow: hidden;
              margin: 20px 0;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            ">
              ${serviceData.imageUrl ? `
                <a href="${serviceUrl}" style="display: block; text-decoration: none;">
                  <img src="${serviceData.imageUrl}" alt="${serviceData.serviceName}" style="
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                  ">
                </a>
              ` : ''}
              <div style="
                background-color: #1a1a2e;
                padding: 16px 20px;
              ">
                <div style="
                  color: white;
                  font-weight: bold;
                  font-size: 18px;
                  margin-bottom: 4px;
                ">${serviceData.serviceName}</div>
                <div style="
                  color: #10B981;
                  font-weight: bold;
                  font-size: 16px;
                ">$${serviceData.priceUsd.toFixed(2)}</div>
              </div>
            </div>
          `;
        }

        // Fallback to generic card if no service data
        return `
          <div style="
            background-color: ${style.backgroundColor || '#10B981'};
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
          ">
            <div style="
              width: 60px;
              height: 60px;
              background: rgba(255,255,255,0.2);
              border-radius: 50%;
              margin: 0 auto 15px;
            ">
              <span style="font-size: 24px; line-height: 60px;">🔧</span>
            </div>
            <div style="color: white; font-weight: bold;">Featured Service</div>
          </div>
        `;

      case 'image':
        return `
          <div style="text-align: center; margin: 20px 0;">
            <img src="${block.src}" alt="" style="max-width: ${style.maxWidth || '100%'}; height: auto; border-radius: 4px;">
          </div>
        `;

      case 'divider':
        return `<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">`;

      case 'spacer':
        return `<div style="height: ${style.height || '20px'};"></div>`;

      default:
        return '';
    }
  }
}

// Extend EmailService to support marketing emails
declare module './EmailService' {
  interface EmailService {
    sendMarketingEmail(params: {
      to: string;
      subject: string;
      html: string;
      campaignId: string;
    }): Promise<boolean>;
  }
}

// Add marketing email method to EmailService prototype
EmailService.prototype.sendMarketingEmail = async function(params: {
  to: string;
  subject: string;
  html: string;
  campaignId: string;
}): Promise<boolean> {
  // Use the existing sendEmail method
  return (this as any).sendEmail(params.to, params.subject, params.html);
};
