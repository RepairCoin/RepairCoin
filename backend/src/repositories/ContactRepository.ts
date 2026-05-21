// backend/src/repositories/ContactRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface Contact {
  id: string;
  shopId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'unsubscribed' | 'bounced' | 'invalid';
  source: 'manual' | 'csv' | 'api';
  tags: string[];
  notes: string | null;
  emailSentCount: number;
  smsSentCount: number;
  lastEmailSentAt: Date | null;
  lastSmsSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactData {
  shopId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  source?: 'manual' | 'csv' | 'api';
  tags?: string[];
  notes?: string | null;
}

export interface UpdateContactData {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  status?: 'active' | 'unsubscribed' | 'bounced' | 'invalid';
  tags?: string[];
  notes?: string | null;
}

export interface CommunicationCampaign {
  id: string;
  shopId: string;
  campaignName: string;
  campaignType: 'email' | 'sms' | 'both';
  subject: string | null;
  messageTemplate: string;
  targetStatus: string[];
  targetTags: string[] | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCampaignData {
  shopId: string;
  campaignName: string;
  campaignType: 'email' | 'sms' | 'both';
  subject?: string | null;
  messageTemplate: string;
  targetStatus?: string[];
  targetTags?: string[] | null;
  createdBy: string;
  scheduledAt?: Date | null;
}

export class ContactRepository extends BaseRepository {
  constructor() {
    super();
  }

  /**
   * Create a new contact
   */
  async createContact(data: CreateContactData): Promise<Contact> {
    // Validate at least one contact method
    if (!data.email && !data.phone) {
      throw new Error('At least one contact method (email or phone) is required');
    }

    const query = `
      INSERT INTO contact_imports (
        shop_id, full_name, email, phone, source, tags, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      data.shopId,
      data.fullName,
      data.email || null,
      data.phone || null,
      data.source || 'manual',
      data.tags || [],
      data.notes || null
    ];

    try {
      const result = await this.pool.query(query, values);
      logger.info(`Contact created for shop ${data.shopId}`, { contactId: result.rows[0].id });
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const dbError = error as { code: string; constraint?: string };
        if (dbError.code === '23505') { // Unique constraint violation
          if (dbError.constraint?.includes('email')) {
            throw new Error('A contact with this email already exists for this shop');
          }
          if (dbError.constraint?.includes('phone')) {
            throw new Error('A contact with this phone number already exists for this shop');
          }
        }
      }
      throw error;
    }
  }

  /**
   * Bulk import contacts (from CSV)
   */
  async bulkCreateContacts(contacts: CreateContactData[]): Promise<{ created: number; errors: Array<{ row: number; error: string; }> }> {
    const errors: Array<{ row: number; error: string; }> = [];
    let created = 0;

    for (let i = 0; i < contacts.length; i++) {
      try {
        await this.createContact(contacts[i]);
        created++;
      } catch (error: unknown) {
        let errorMessage = 'Unknown error';
        if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = (error as { message: string }).message;
        }
        errors.push({ row: i + 1, error: errorMessage });
      }
    }

    logger.info(`Bulk contact import completed`, { created, errors: errors.length });

    return { created, errors };
  }

  /**
   * Get contact by ID
   */
  async getContactById(contactId: string): Promise<Contact> {
    const query = 'SELECT * FROM contact_imports WHERE id = $1';
    const result = await this.pool.query(query, [contactId]);

    if (result.rows.length === 0) {
      throw new Error('Contact not found');
    }

    return this.mapSnakeToCamel(result.rows[0]);
  }

  /**
   * Get all contacts for a shop
   */
  async getContacts(
    shopId: string,
    options: {
      status?: string;
      tags?: string[];
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ contacts: Contact[]; total: number; }> {
    const { status, tags, search, page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['shop_id = $1'];
    const values: Array<string | number | string[]> = [shopId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (tags && tags.length > 0) {
      conditions.push(`tags && $${paramIndex++}::text[]`);
      values.push(tags);
    }

    if (search) {
      conditions.push(`(
        full_name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM contact_imports WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0].count);

    // Get contacts
    const query = `
      SELECT *
      FROM contact_imports
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await this.pool.query(query, [...values, limit, offset]);
    const contacts = result.rows.map(row => this.mapSnakeToCamel(row));

    return { contacts, total };
  }

  /**
   * Update contact
   */
  async updateContact(contactId: string, data: UpdateContactData): Promise<Contact> {
    const updates: string[] = [];
    const values: Array<string | string[] | null> = [];
    let paramIndex = 1;

    if (data.fullName !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(data.fullName);
    }

    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(data.email);
    }

    if (data.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(data.phone);
    }

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(data.tags);
    }

    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }

    if (updates.length === 0) {
      throw new Error('No updates provided');
    }

    values.push(contactId);

    const query = `
      UPDATE contact_imports
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Contact not found');
    }

    logger.info(`Contact updated: ${contactId}`);

    return this.mapSnakeToCamel(result.rows[0]);
  }

  /**
   * Delete contact
   */
  async deleteContact(contactId: string): Promise<void> {
    const query = 'DELETE FROM contact_imports WHERE id = $1';
    const result = await this.pool.query(query, [contactId]);

    if (result.rowCount === 0) {
      throw new Error('Contact not found');
    }

    logger.info(`Contact deleted: ${contactId}`);
  }

  /**
   * Get contact statistics for a shop
   */
  async getContactStats(shopId: string): Promise<{
    total: number;
    active: number;
    unsubscribed: number;
    bounced: number;
    invalid: number;
    withEmail: number;
    withPhone: number;
    totalEmailsSent: number;
    totalSmsSent: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE status = 'invalid') as invalid,
        COUNT(*) FILTER (WHERE email IS NOT NULL) as with_email,
        COUNT(*) FILTER (WHERE phone IS NOT NULL) as with_phone,
        COALESCE(SUM(email_sent_count), 0) as total_emails_sent,
        COALESCE(SUM(sms_sent_count), 0) as total_sms_sent
      FROM contact_imports
      WHERE shop_id = $1
    `;

    const result = await this.pool.query(query, [shopId]);
    const stats = result.rows[0];

    return {
      total: parseInt(stats.total),
      active: parseInt(stats.active),
      unsubscribed: parseInt(stats.unsubscribed),
      bounced: parseInt(stats.bounced),
      invalid: parseInt(stats.invalid),
      withEmail: parseInt(stats.with_email),
      withPhone: parseInt(stats.with_phone),
      totalEmailsSent: parseInt(stats.total_emails_sent),
      totalSmsSent: parseInt(stats.total_sms_sent)
    };
  }

  /**
   * Create a communication campaign
   */
  async createCampaign(data: CreateCampaignData): Promise<CommunicationCampaign> {
    const query = `
      INSERT INTO communication_campaigns (
        shop_id, campaign_name, campaign_type, subject,
        message_template, target_status, target_tags,
        scheduled_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      data.shopId,
      data.campaignName,
      data.campaignType,
      data.subject || null,
      data.messageTemplate,
      data.targetStatus || ['active'],
      data.targetTags || null,
      data.scheduledAt || null,
      data.createdBy
    ];

    const result = await this.pool.query(query, values);
    logger.info(`Campaign created for shop ${data.shopId}`, { campaignId: result.rows[0].id });

    return this.mapSnakeToCamel(result.rows[0]);
  }

  /**
   * Get campaigns for a shop
   */
  async getCampaigns(shopId: string): Promise<CommunicationCampaign[]> {
    const query = `
      SELECT *
      FROM communication_campaigns
      WHERE shop_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [shopId]);
    return result.rows.map(row => this.mapSnakeToCamel(row));
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(campaignId: string): Promise<CommunicationCampaign> {
    const query = 'SELECT * FROM communication_campaigns WHERE id = $1';
    const result = await this.pool.query(query, [campaignId]);

    if (result.rows.length === 0) {
      throw new Error('Campaign not found');
    }

    return this.mapSnakeToCamel(result.rows[0]);
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    campaignId: string,
    status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed'
  ): Promise<CommunicationCampaign> {
    const updates: string[] = ['status = $1'];
    const values: Array<string | Date> = [status];
    let paramIndex = 2;

    if (status === 'sending') {
      updates.push(`started_at = $${paramIndex++}`);
      values.push(new Date());
    } else if (status === 'completed' || status === 'failed') {
      updates.push(`completed_at = $${paramIndex++}`);
      values.push(new Date());
    }

    values.push(campaignId);

    const query = `
      UPDATE communication_campaigns
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Campaign not found');
    }

    logger.info(`Campaign status updated: ${campaignId} -> ${status}`);

    return this.mapSnakeToCamel(result.rows[0]);
  }

  /**
   * Increment contact communication counters
   */
  async incrementContactCounter(
    contactId: string,
    type: 'email' | 'sms'
  ): Promise<void> {
    const field = type === 'email' ? 'email_sent_count' : 'sms_sent_count';
    const timestampField = type === 'email' ? 'last_email_sent_at' : 'last_sms_sent_at';

    const query = `
      UPDATE contact_imports
      SET ${field} = ${field} + 1,
          ${timestampField} = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.pool.query(query, [contactId]);
  }
}
