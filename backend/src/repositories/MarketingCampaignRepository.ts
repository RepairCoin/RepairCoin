import { BaseRepository, PaginatedResult, PaginationParams } from './BaseRepository';
import { logger } from '../utils/logger';

export interface MarketingCampaign {
  id: string;
  shopId: string;
  name: string;
  campaignType: 'announce_service' | 'offer_coupon' | 'newsletter' | 'custom';
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  subject: string | null;
  previewText: string | null;
  designContent: Record<string, any>;
  templateId: string | null;
  audienceType: 'all_customers' | 'select_customers' | 'top_spenders' | 'frequent_visitors' | 'active_customers' | 'custom';
  audienceFilters: Record<string, any>;
  deliveryMethod: 'email' | 'in_app' | 'both';
  scheduledAt: Date | null;
  sentAt: Date | null;
  promoCodeId: number | null;
  couponValue: number | null;
  couponType: 'fixed' | 'percentage' | null;
  couponExpiresAt: Date | null;
  serviceId: string | null;
  totalRecipients: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  inAppSent: number;
  inAppRead: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  customerAddress: string;
  customerEmail: string | null;
  emailSentAt: Date | null;
  emailOpenedAt: Date | null;
  emailClickedAt: Date | null;
  inAppSentAt: Date | null;
  inAppReadAt: Date | null;
  deliveryError: string | null;
  createdAt: Date;
}

export interface MarketingTemplate {
  id: string;
  name: string;
  description: string | null;
  category: 'coupon' | 'announcement' | 'newsletter' | 'event';
  thumbnailUrl: string | null;
  designContent: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateCampaignParams {
  shopId: string;
  name: string;
  campaignType: MarketingCampaign['campaignType'];
  subject?: string;
  previewText?: string;
  designContent?: Record<string, any>;
  templateId?: string;
  audienceType?: MarketingCampaign['audienceType'];
  audienceFilters?: Record<string, any>;
  deliveryMethod?: MarketingCampaign['deliveryMethod'];
  scheduledAt?: Date;
  promoCodeId?: number;
  couponValue?: number;
  couponType?: 'fixed' | 'percentage';
  couponExpiresAt?: Date;
  serviceId?: string;
}

export interface UpdateCampaignParams {
  name?: string;
  subject?: string;
  previewText?: string;
  designContent?: Record<string, any>;
  templateId?: string;
  audienceType?: MarketingCampaign['audienceType'];
  audienceFilters?: Record<string, any>;
  deliveryMethod?: MarketingCampaign['deliveryMethod'];
  scheduledAt?: Date | null;
  status?: MarketingCampaign['status'];
  promoCodeId?: number | null;
  couponValue?: number | null;
  couponType?: 'fixed' | 'percentage' | null;
  couponExpiresAt?: Date | null;
  serviceId?: string | null;
}

export class MarketingCampaignRepository extends BaseRepository {

  async create(params: CreateCampaignParams): Promise<MarketingCampaign> {
    const query = `
      INSERT INTO marketing_campaigns (
        shop_id, name, campaign_type, subject, preview_text,
        design_content, template_id, audience_type, audience_filters,
        delivery_method, scheduled_at, promo_code_id, coupon_value,
        coupon_type, coupon_expires_at, service_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
    `;

    const values = [
      params.shopId,
      params.name,
      params.campaignType,
      params.subject || null,
      params.previewText || null,
      JSON.stringify(params.designContent || {}),
      params.templateId || null,
      params.audienceType || 'all_customers',
      JSON.stringify(params.audienceFilters || {}),
      params.deliveryMethod || 'in_app',
      params.scheduledAt || null,
      params.promoCodeId || null,
      params.couponValue || null,
      params.couponType || null,
      params.couponExpiresAt || null,
      params.serviceId || null
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapCampaign(result.rows[0]);
    } catch (error: any) {
      logger.error('Error creating marketing campaign:', error);
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  }

  async findById(id: string): Promise<MarketingCampaign | null> {
    const query = 'SELECT * FROM marketing_campaigns WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows.length === 0) return null;
      return this.mapCampaign(result.rows[0]);
    } catch (error: any) {
      logger.error('Error finding campaign by ID:', error);
      throw new Error(`Failed to find campaign: ${error.message}`);
    }
  }

  async findByShop(
    shopId: string,
    pagination: PaginationParams,
    status?: MarketingCampaign['status']
  ): Promise<PaginatedResult<MarketingCampaign>> {
    const offset = this.getPaginationOffset(pagination.page, pagination.limit);

    let countQuery = 'SELECT COUNT(*) FROM marketing_campaigns WHERE shop_id = $1';
    let dataQuery = 'SELECT * FROM marketing_campaigns WHERE shop_id = $1';
    const values: any[] = [shopId];

    if (status) {
      countQuery += ' AND status = $2';
      dataQuery += ' AND status = $2';
      values.push(status);
    }

    dataQuery += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;

    try {
      const countResult = await this.pool.query(countQuery, values);
      const totalItems = parseInt(countResult.rows[0].count, 10);

      const dataResult = await this.pool.query(dataQuery, [...values, pagination.limit, offset]);
      const items = dataResult.rows.map(row => this.mapCampaign(row));

      const totalPages = Math.ceil(totalItems / pagination.limit);

      return {
        items,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          totalItems,
          totalPages,
          hasMore: pagination.page < totalPages
        }
      };
    } catch (error: any) {
      logger.error('Error finding campaigns by shop:', error);
      throw new Error(`Failed to find campaigns: ${error.message}`);
    }
  }

  async update(id: string, params: UpdateCampaignParams): Promise<MarketingCampaign> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(params.name);
    }
    if (params.subject !== undefined) {
      updates.push(`subject = $${paramIndex++}`);
      values.push(params.subject);
    }
    if (params.previewText !== undefined) {
      updates.push(`preview_text = $${paramIndex++}`);
      values.push(params.previewText);
    }
    if (params.designContent !== undefined) {
      updates.push(`design_content = $${paramIndex++}`);
      values.push(JSON.stringify(params.designContent));
    }
    if (params.templateId !== undefined) {
      updates.push(`template_id = $${paramIndex++}`);
      values.push(params.templateId);
    }
    if (params.audienceType !== undefined) {
      updates.push(`audience_type = $${paramIndex++}`);
      values.push(params.audienceType);
    }
    if (params.audienceFilters !== undefined) {
      updates.push(`audience_filters = $${paramIndex++}`);
      values.push(JSON.stringify(params.audienceFilters));
    }
    if (params.deliveryMethod !== undefined) {
      updates.push(`delivery_method = $${paramIndex++}`);
      values.push(params.deliveryMethod);
    }
    if (params.scheduledAt !== undefined) {
      updates.push(`scheduled_at = $${paramIndex++}`);
      values.push(params.scheduledAt);
    }
    if (params.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }
    if (params.promoCodeId !== undefined) {
      updates.push(`promo_code_id = $${paramIndex++}`);
      values.push(params.promoCodeId);
    }
    if (params.couponValue !== undefined) {
      updates.push(`coupon_value = $${paramIndex++}`);
      values.push(params.couponValue);
    }
    if (params.couponType !== undefined) {
      updates.push(`coupon_type = $${paramIndex++}`);
      values.push(params.couponType);
    }
    if (params.couponExpiresAt !== undefined) {
      updates.push(`coupon_expires_at = $${paramIndex++}`);
      values.push(params.couponExpiresAt);
    }
    if (params.serviceId !== undefined) {
      updates.push(`service_id = $${paramIndex++}`);
      values.push(params.serviceId);
    }

    updates.push(`updated_at = NOW()`);

    const query = `
      UPDATE marketing_campaigns
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    values.push(id);

    try {
      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) {
        throw new Error('Campaign not found');
      }
      return this.mapCampaign(result.rows[0]);
    } catch (error: any) {
      logger.error('Error updating campaign:', error);
      throw new Error(`Failed to update campaign: ${error.message}`);
    }
  }

  async updateStats(
    id: string,
    stats: {
      totalRecipients?: number;
      emailsSent?: number;
      emailsOpened?: number;
      emailsClicked?: number;
      inAppSent?: number;
      inAppRead?: number;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (stats.totalRecipients !== undefined) {
      updates.push(`total_recipients = $${paramIndex++}`);
      values.push(stats.totalRecipients);
    }
    if (stats.emailsSent !== undefined) {
      updates.push(`emails_sent = $${paramIndex++}`);
      values.push(stats.emailsSent);
    }
    if (stats.emailsOpened !== undefined) {
      updates.push(`emails_opened = $${paramIndex++}`);
      values.push(stats.emailsOpened);
    }
    if (stats.emailsClicked !== undefined) {
      updates.push(`emails_clicked = $${paramIndex++}`);
      values.push(stats.emailsClicked);
    }
    if (stats.inAppSent !== undefined) {
      updates.push(`in_app_sent = $${paramIndex++}`);
      values.push(stats.inAppSent);
    }
    if (stats.inAppRead !== undefined) {
      updates.push(`in_app_read = $${paramIndex++}`);
      values.push(stats.inAppRead);
    }

    if (updates.length === 0) return;

    updates.push(`updated_at = NOW()`);

    const query = `
      UPDATE marketing_campaigns
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;
    values.push(id);

    try {
      await this.pool.query(query, values);
    } catch (error: any) {
      logger.error('Error updating campaign stats:', error);
      throw new Error(`Failed to update campaign stats: ${error.message}`);
    }
  }

  async markAsSent(id: string): Promise<MarketingCampaign> {
    const query = `
      UPDATE marketing_campaigns
      SET status = 'sent', sent_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows.length === 0) {
        throw new Error('Campaign not found');
      }
      return this.mapCampaign(result.rows[0]);
    } catch (error: any) {
      logger.error('Error marking campaign as sent:', error);
      throw new Error(`Failed to mark campaign as sent: ${error.message}`);
    }
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM marketing_campaigns WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      logger.error('Error deleting campaign:', error);
      throw new Error(`Failed to delete campaign: ${error.message}`);
    }
  }

  // Recipients methods
  async addRecipient(
    campaignId: string,
    customerAddress: string,
    customerEmail?: string
  ): Promise<CampaignRecipient> {
    const query = `
      INSERT INTO marketing_campaign_recipients (campaign_id, customer_address, customer_email)
      VALUES ($1, $2, $3)
      ON CONFLICT (campaign_id, customer_address) DO UPDATE SET customer_email = EXCLUDED.customer_email
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        campaignId,
        customerAddress.toLowerCase(),
        customerEmail || null
      ]);
      return this.mapRecipient(result.rows[0]);
    } catch (error: any) {
      logger.error('Error adding campaign recipient:', error);
      throw new Error(`Failed to add recipient: ${error.message}`);
    }
  }

  async addRecipients(
    campaignId: string,
    recipients: Array<{ customerAddress: string; customerEmail?: string }>
  ): Promise<number> {
    if (recipients.length === 0) return 0;

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const recipient of recipients) {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(campaignId, recipient.customerAddress.toLowerCase(), recipient.customerEmail || null);
    }

    const query = `
      INSERT INTO marketing_campaign_recipients (campaign_id, customer_address, customer_email)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (campaign_id, customer_address) DO NOTHING
    `;

    try {
      const result = await this.pool.query(query, values);
      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('Error adding campaign recipients:', error);
      throw new Error(`Failed to add recipients: ${error.message}`);
    }
  }

  async getRecipients(
    campaignId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<CampaignRecipient>> {
    const offset = this.getPaginationOffset(pagination.page, pagination.limit);

    const countQuery = 'SELECT COUNT(*) FROM marketing_campaign_recipients WHERE campaign_id = $1';
    const dataQuery = `
      SELECT * FROM marketing_campaign_recipients
      WHERE campaign_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const countResult = await this.pool.query(countQuery, [campaignId]);
      const totalItems = parseInt(countResult.rows[0].count, 10);

      const dataResult = await this.pool.query(dataQuery, [campaignId, pagination.limit, offset]);
      const items = dataResult.rows.map(row => this.mapRecipient(row));

      const totalPages = Math.ceil(totalItems / pagination.limit);

      return {
        items,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          totalItems,
          totalPages,
          hasMore: pagination.page < totalPages
        }
      };
    } catch (error: any) {
      logger.error('Error getting campaign recipients:', error);
      throw new Error(`Failed to get recipients: ${error.message}`);
    }
  }

  async updateRecipientStatus(
    campaignId: string,
    customerAddress: string,
    status: {
      emailSentAt?: Date;
      emailOpenedAt?: Date;
      emailClickedAt?: Date;
      inAppSentAt?: Date;
      inAppReadAt?: Date;
      deliveryError?: string;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status.emailSentAt) {
      updates.push(`email_sent_at = $${paramIndex++}`);
      values.push(status.emailSentAt);
    }
    if (status.emailOpenedAt) {
      updates.push(`email_opened_at = $${paramIndex++}`);
      values.push(status.emailOpenedAt);
    }
    if (status.emailClickedAt) {
      updates.push(`email_clicked_at = $${paramIndex++}`);
      values.push(status.emailClickedAt);
    }
    if (status.inAppSentAt) {
      updates.push(`in_app_sent_at = $${paramIndex++}`);
      values.push(status.inAppSentAt);
    }
    if (status.inAppReadAt) {
      updates.push(`in_app_read_at = $${paramIndex++}`);
      values.push(status.inAppReadAt);
    }
    if (status.deliveryError) {
      updates.push(`delivery_error = $${paramIndex++}`);
      values.push(status.deliveryError);
    }

    if (updates.length === 0) return;

    const query = `
      UPDATE marketing_campaign_recipients
      SET ${updates.join(', ')}
      WHERE campaign_id = $${paramIndex} AND customer_address = $${paramIndex + 1}
    `;
    values.push(campaignId, customerAddress.toLowerCase());

    try {
      await this.pool.query(query, values);
    } catch (error: any) {
      logger.error('Error updating recipient status:', error);
      throw new Error(`Failed to update recipient status: ${error.message}`);
    }
  }

  // Templates methods
  async getTemplates(category?: string): Promise<MarketingTemplate[]> {
    let query = 'SELECT * FROM marketing_templates WHERE is_active = true';
    const values: any[] = [];

    if (category) {
      query += ' AND category = $1';
      values.push(category);
    }

    query += ' ORDER BY name';

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.mapTemplate(row));
    } catch (error: any) {
      logger.error('Error getting templates:', error);
      throw new Error(`Failed to get templates: ${error.message}`);
    }
  }

  async getTemplateById(id: string): Promise<MarketingTemplate | null> {
    const query = 'SELECT * FROM marketing_templates WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows.length === 0) return null;
      return this.mapTemplate(result.rows[0]);
    } catch (error: any) {
      logger.error('Error getting template by ID:', error);
      throw new Error(`Failed to get template: ${error.message}`);
    }
  }

  // Statistics
  async getCampaignStats(shopId: string): Promise<{
    totalCampaigns: number;
    draftCampaigns: number;
    sentCampaigns: number;
    totalEmailsSent: number;
    totalEmailsOpened: number;
    totalInAppSent: number;
    totalInAppRead: number;
    avgOpenRate: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_campaigns,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_campaigns,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_campaigns,
        COALESCE(SUM(emails_sent), 0) as total_emails_sent,
        COALESCE(SUM(emails_opened), 0) as total_emails_opened,
        COALESCE(SUM(in_app_sent), 0) as total_in_app_sent,
        COALESCE(SUM(in_app_read), 0) as total_in_app_read
      FROM marketing_campaigns
      WHERE shop_id = $1
    `;

    try {
      const result = await this.pool.query(query, [shopId]);
      const row = result.rows[0];

      const totalEmailsSent = parseInt(row.total_emails_sent, 10);
      const totalEmailsOpened = parseInt(row.total_emails_opened, 10);

      return {
        totalCampaigns: parseInt(row.total_campaigns, 10),
        draftCampaigns: parseInt(row.draft_campaigns, 10),
        sentCampaigns: parseInt(row.sent_campaigns, 10),
        totalEmailsSent,
        totalEmailsOpened,
        totalInAppSent: parseInt(row.total_in_app_sent, 10),
        totalInAppRead: parseInt(row.total_in_app_read, 10),
        avgOpenRate: totalEmailsSent > 0 ? (totalEmailsOpened / totalEmailsSent) * 100 : 0
      };
    } catch (error: any) {
      logger.error('Error getting campaign stats:', error);
      throw new Error(`Failed to get campaign stats: ${error.message}`);
    }
  }

  // Scheduled campaigns
  async getScheduledCampaigns(): Promise<MarketingCampaign[]> {
    const query = `
      SELECT * FROM marketing_campaigns
      WHERE status = 'scheduled'
        AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
    `;

    try {
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapCampaign(row));
    } catch (error: any) {
      logger.error('Error getting scheduled campaigns:', error);
      throw new Error(`Failed to get scheduled campaigns: ${error.message}`);
    }
  }

  private mapCampaign(row: any): MarketingCampaign {
    return {
      id: row.id,
      shopId: row.shop_id,
      name: row.name,
      campaignType: row.campaign_type,
      status: row.status,
      subject: row.subject,
      previewText: row.preview_text,
      designContent: typeof row.design_content === 'string'
        ? JSON.parse(row.design_content)
        : row.design_content,
      templateId: row.template_id,
      audienceType: row.audience_type,
      audienceFilters: typeof row.audience_filters === 'string'
        ? JSON.parse(row.audience_filters)
        : row.audience_filters,
      deliveryMethod: row.delivery_method,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      promoCodeId: row.promo_code_id,
      couponValue: row.coupon_value ? parseFloat(row.coupon_value) : null,
      couponType: row.coupon_type,
      couponExpiresAt: row.coupon_expires_at ? new Date(row.coupon_expires_at) : null,
      serviceId: row.service_id,
      totalRecipients: row.total_recipients || 0,
      emailsSent: row.emails_sent || 0,
      emailsOpened: row.emails_opened || 0,
      emailsClicked: row.emails_clicked || 0,
      inAppSent: row.in_app_sent || 0,
      inAppRead: row.in_app_read || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRecipient(row: any): CampaignRecipient {
    return {
      id: row.id,
      campaignId: row.campaign_id,
      customerAddress: row.customer_address,
      customerEmail: row.customer_email,
      emailSentAt: row.email_sent_at ? new Date(row.email_sent_at) : null,
      emailOpenedAt: row.email_opened_at ? new Date(row.email_opened_at) : null,
      emailClickedAt: row.email_clicked_at ? new Date(row.email_clicked_at) : null,
      inAppSentAt: row.in_app_sent_at ? new Date(row.in_app_sent_at) : null,
      inAppReadAt: row.in_app_read_at ? new Date(row.in_app_read_at) : null,
      deliveryError: row.delivery_error,
      createdAt: new Date(row.created_at)
    };
  }

  private mapTemplate(row: any): MarketingTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      thumbnailUrl: row.thumbnail_url,
      designContent: typeof row.design_content === 'string'
        ? JSON.parse(row.design_content)
        : row.design_content,
      isActive: row.is_active,
      createdAt: new Date(row.created_at)
    };
  }
}
