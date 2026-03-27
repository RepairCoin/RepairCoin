// backend/src/repositories/GmailRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface GmailConnection {
  id: string;
  shopId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
  emailAddress: string;
  displayName?: string;
  isActive: boolean;
  lastEmailSentAt?: Date;
  totalEmailsSent: number;
  lastSyncStatus?: 'success' | 'failed' | 'token_expired';
  syncErrorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SentEmailLog {
  id: string;
  shopId: string;
  toEmail: string;
  toName?: string;
  subject: string;
  bodyPreview?: string;
  orderId?: string;
  customerAddress?: string;
  emailType: 'booking_confirmation' | 'reminder' | 'promotional' | 'support' | 'manual' | 'cancellation' | 'reschedule';
  status: 'sent' | 'failed' | 'bounced';
  errorMessage?: string;
  gmailMessageId?: string;
  sentAt: Date;
}

export class GmailRepository extends BaseRepository {
  /**
   * Save a new Gmail connection
   */
  async saveConnection(connection: {
    shopId: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiry: Date;
    emailAddress: string;
    displayName?: string;
  }): Promise<GmailConnection> {
    try {
      const query = `
        INSERT INTO shop_gmail_connections (
          shop_id,
          access_token,
          refresh_token,
          token_expiry,
          email_address,
          display_name,
          is_active,
          last_sync_status
        ) VALUES ($1, $2, $3, $4, $5, $6, true, 'success')
        ON CONFLICT (shop_id)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expiry = EXCLUDED.token_expiry,
          email_address = EXCLUDED.email_address,
          display_name = EXCLUDED.display_name,
          is_active = true,
          last_sync_status = 'success',
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const values = [
        connection.shopId,
        connection.accessToken,
        connection.refreshToken,
        connection.tokenExpiry,
        connection.emailAddress,
        connection.displayName,
      ];

      const result = await this.pool.query(query, values);
      return this.mapToGmailConnection(result.rows[0]);
    } catch (error) {
      logger.error('Error saving Gmail connection:', error);
      throw error;
    }
  }

  /**
   * Get active Gmail connection for a shop
   */
  async getActiveConnection(shopId: string): Promise<GmailConnection | null> {
    try {
      const query = `
        SELECT * FROM shop_gmail_connections
        WHERE shop_id = $1 AND is_active = true
        LIMIT 1
      `;

      const result = await this.pool.query(query, [shopId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapToGmailConnection(result.rows[0]);
    } catch (error) {
      logger.error('Error getting active Gmail connection:', error);
      throw error;
    }
  }

  /**
   * Update access token (after refresh)
   */
  async updateAccessToken(
    shopId: string,
    accessToken: string,
    tokenExpiry: Date
  ): Promise<void> {
    try {
      const query = `
        UPDATE shop_gmail_connections
        SET access_token = $1,
            token_expiry = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $3 AND is_active = true
      `;

      await this.pool.query(query, [accessToken, tokenExpiry, shopId]);
    } catch (error) {
      logger.error('Error updating access token:', error);
      throw error;
    }
  }

  /**
   * Update last sync status
   */
  async updateLastSync(
    shopId: string,
    status: 'success' | 'failed' | 'token_expired',
    errorMessage?: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE shop_gmail_connections
        SET last_sync_status = $1,
            sync_error_message = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $3 AND is_active = true
      `;

      await this.pool.query(query, [status, errorMessage || null, shopId]);
    } catch (error) {
      logger.error('Error updating last sync:', error);
      throw error;
    }
  }

  /**
   * Disconnect Gmail (soft delete)
   */
  async disconnectGmail(shopId: string): Promise<void> {
    try {
      const query = `
        UPDATE shop_gmail_connections
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $1
      `;

      await this.pool.query(query, [shopId]);

      logger.info('Gmail disconnected', { shopId });
    } catch (error) {
      logger.error('Error disconnecting Gmail:', error);
      throw error;
    }
  }

  /**
   * Increment email sent counter
   */
  async incrementEmailCounter(shopId: string): Promise<void> {
    try {
      const query = `
        UPDATE shop_gmail_connections
        SET total_emails_sent = total_emails_sent + 1,
            last_email_sent_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $1 AND is_active = true
      `;

      await this.pool.query(query, [shopId]);
    } catch (error) {
      logger.error('Error incrementing email counter:', error);
      throw error;
    }
  }

  /**
   * Log sent email
   */
  async logSentEmail(emailLog: {
    shopId: string;
    toEmail: string;
    toName?: string;
    subject: string;
    bodyPreview?: string;
    orderId?: string;
    customerAddress?: string;
    emailType: SentEmailLog['emailType'];
    status: 'sent' | 'failed' | 'bounced';
    errorMessage?: string;
    gmailMessageId?: string;
  }): Promise<void> {
    try {
      const query = `
        INSERT INTO sent_emails_log (
          shop_id,
          to_email,
          to_name,
          subject,
          body_preview,
          order_id,
          customer_address,
          email_type,
          status,
          error_message,
          gmail_message_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;

      const values = [
        emailLog.shopId,
        emailLog.toEmail,
        emailLog.toName || null,
        emailLog.subject,
        emailLog.bodyPreview || null,
        emailLog.orderId || null,
        emailLog.customerAddress || null,
        emailLog.emailType,
        emailLog.status,
        emailLog.errorMessage || null,
        emailLog.gmailMessageId || null,
      ];

      await this.pool.query(query, values);
    } catch (error) {
      logger.error('Error logging sent email:', error);
      throw error;
    }
  }

  /**
   * Get email statistics for a shop
   */
  async getEmailStats(shopId: string): Promise<{
    totalSent: number;
    sentToday: number;
    sentThisWeek: number;
    sentThisMonth: number;
    byType: Record<string, number>;
  }> {
    try {
      const query = `
        SELECT
          COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
          COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= CURRENT_DATE) as sent_today,
          COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= CURRENT_DATE - INTERVAL '7 days') as sent_this_week,
          COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= CURRENT_DATE - INTERVAL '30 days') as sent_this_month,
          json_object_agg(email_type, type_count) as by_type
        FROM sent_emails_log
        LEFT JOIN LATERAL (
          SELECT email_type, COUNT(*) as type_count
          FROM sent_emails_log
          WHERE shop_id = $1 AND status = 'sent'
          GROUP BY email_type
        ) type_stats ON true
        WHERE shop_id = $1
      `;

      const result = await this.pool.query(query, [shopId]);
      const row = result.rows[0];

      return {
        totalSent: parseInt(row.total_sent) || 0,
        sentToday: parseInt(row.sent_today) || 0,
        sentThisWeek: parseInt(row.sent_this_week) || 0,
        sentThisMonth: parseInt(row.sent_this_month) || 0,
        byType: row.by_type || {},
      };
    } catch (error) {
      logger.error('Error getting email stats:', error);
      throw error;
    }
  }

  /**
   * Get connections with expiring tokens (for proactive refresh)
   */
  async getConnectionsWithExpiringTokens(
    expiryThreshold: Date
  ): Promise<GmailConnection[]> {
    try {
      const query = `
        SELECT * FROM shop_gmail_connections
        WHERE is_active = true
          AND token_expiry <= $1
        ORDER BY token_expiry ASC
      `;

      const result = await this.pool.query(query, [expiryThreshold]);
      return result.rows.map(row => this.mapToGmailConnection(row));
    } catch (error) {
      logger.error('Error getting connections with expiring tokens:', error);
      throw error;
    }
  }

  /**
   * Map database row to GmailConnection interface
   */
  private mapToGmailConnection(row: any): GmailConnection {
    return {
      id: row.id,
      shopId: row.shop_id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiry: new Date(row.token_expiry),
      emailAddress: row.email_address,
      displayName: row.display_name,
      isActive: row.is_active,
      lastEmailSentAt: row.last_email_sent_at ? new Date(row.last_email_sent_at) : undefined,
      totalEmailsSent: row.total_emails_sent,
      lastSyncStatus: row.last_sync_status,
      syncErrorMessage: row.sync_error_message,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
