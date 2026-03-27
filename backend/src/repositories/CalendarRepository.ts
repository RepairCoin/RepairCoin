// backend/src/repositories/CalendarRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface CalendarConnection {
  id: string;
  shopId: string;
  provider: 'google' | 'outlook' | 'apple';
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
  calendarId: string;
  googleAccountEmail?: string;
  isActive: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'success' | 'failed' | 'token_expired';
  syncErrorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarSyncUpdate {
  orderId: string;
  calendarEventId?: string;
  syncStatus: 'not_synced' | 'synced' | 'failed' | 'deleted';
  syncError?: string;
}

export class CalendarRepository extends BaseRepository {
  /**
   * Save a new calendar connection
   */
  async saveConnection(connection: {
    shopId: string;
    provider: 'google' | 'outlook' | 'apple';
    accessToken: string;
    refreshToken: string;
    tokenExpiry: Date;
    calendarId?: string;
    googleAccountEmail?: string;
  }): Promise<CalendarConnection> {
    try {
      const query = `
        INSERT INTO shop_calendar_connections (
          shop_id,
          provider,
          access_token,
          refresh_token,
          token_expiry,
          calendar_id,
          google_account_email,
          is_active,
          last_sync_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'success')
        ON CONFLICT (shop_id, provider)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expiry = EXCLUDED.token_expiry,
          calendar_id = EXCLUDED.calendar_id,
          google_account_email = EXCLUDED.google_account_email,
          is_active = true,
          last_sync_status = 'success',
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const values = [
        connection.shopId,
        connection.provider,
        connection.accessToken,
        connection.refreshToken,
        connection.tokenExpiry,
        connection.calendarId || 'primary',
        connection.googleAccountEmail,
      ];

      const result = await this.pool.query(query, values);
      return this.mapToCalendarConnection(result.rows[0]);
    } catch (error) {
      logger.error('Error saving calendar connection:', error);
      throw error;
    }
  }

  /**
   * Get active calendar connection for a shop
   */
  async getActiveConnection(
    shopId: string,
    provider: 'google' | 'outlook' | 'apple' = 'google'
  ): Promise<CalendarConnection | null> {
    try {
      const query = `
        SELECT * FROM shop_calendar_connections
        WHERE shop_id = $1
          AND provider = $2
          AND is_active = true
        LIMIT 1
      `;

      const result = await this.pool.query(query, [shopId, provider]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapToCalendarConnection(result.rows[0]);
    } catch (error) {
      logger.error('Error getting active calendar connection:', error);
      throw error;
    }
  }

  /**
   * Get all connections for a shop (active and inactive)
   */
  async getShopConnections(shopId: string): Promise<CalendarConnection[]> {
    try {
      const query = `
        SELECT * FROM shop_calendar_connections
        WHERE shop_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [shopId]);
      return result.rows.map(row => this.mapToCalendarConnection(row));
    } catch (error) {
      logger.error('Error getting shop calendar connections:', error);
      throw error;
    }
  }

  /**
   * Update access token (after refresh)
   */
  async updateAccessToken(
    shopId: string,
    provider: 'google' | 'outlook' | 'apple',
    accessToken: string,
    tokenExpiry: Date
  ): Promise<void> {
    try {
      const query = `
        UPDATE shop_calendar_connections
        SET access_token = $1,
            token_expiry = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $3
          AND provider = $4
          AND is_active = true
      `;

      await this.pool.query(query, [accessToken, tokenExpiry, shopId, provider]);
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
    provider: 'google' | 'outlook' | 'apple',
    status: 'success' | 'failed' | 'token_expired',
    errorMessage?: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE shop_calendar_connections
        SET last_sync_at = CURRENT_TIMESTAMP,
            last_sync_status = $1,
            sync_error_message = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $3
          AND provider = $4
          AND is_active = true
      `;

      await this.pool.query(query, [status, errorMessage || null, shopId, provider]);
    } catch (error) {
      logger.error('Error updating last sync:', error);
      throw error;
    }
  }

  /**
   * Disconnect calendar (soft delete)
   */
  async disconnectCalendar(
    shopId: string,
    provider: 'google' | 'outlook' | 'apple'
  ): Promise<void> {
    try {
      const query = `
        UPDATE shop_calendar_connections
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $1
          AND provider = $2
      `;

      await this.pool.query(query, [shopId, provider]);

      logger.info('Calendar disconnected', { shopId, provider });
    } catch (error) {
      logger.error('Error disconnecting calendar:', error);
      throw error;
    }
  }

  /**
   * Get connections with expiring tokens (for proactive refresh)
   */
  async getConnectionsWithExpiringTokens(
    expiryThreshold: Date
  ): Promise<CalendarConnection[]> {
    try {
      const query = `
        SELECT * FROM shop_calendar_connections
        WHERE is_active = true
          AND token_expiry <= $1
        ORDER BY token_expiry ASC
      `;

      const result = await this.pool.query(query, [expiryThreshold]);
      return result.rows.map(row => this.mapToCalendarConnection(row));
    } catch (error) {
      logger.error('Error getting connections with expiring tokens:', error);
      throw error;
    }
  }

  /**
   * Update calendar event ID for an order
   */
  async updateOrderCalendarEvent(update: CalendarSyncUpdate): Promise<void> {
    try {
      const query = `
        UPDATE service_orders
        SET google_calendar_event_id = $1,
            calendar_sync_status = $2,
            calendar_sync_error = $3,
            calendar_synced_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $4
      `;

      await this.pool.query(query, [
        update.calendarEventId || null,
        update.syncStatus,
        update.syncError || null,
        update.orderId,
      ]);
    } catch (error) {
      logger.error('Error updating order calendar event:', error);
      throw error;
    }
  }

  /**
   * Get order calendar event ID
   */
  async getOrderCalendarEventId(orderId: string): Promise<string | null> {
    try {
      const query = `
        SELECT google_calendar_event_id
        FROM service_orders
        WHERE order_id = $1
      `;

      const result = await this.pool.query(query, [orderId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].google_calendar_event_id;
    } catch (error) {
      logger.error('Error getting order calendar event ID:', error);
      throw error;
    }
  }

  /**
   * Get orders that need calendar sync (paid but not synced)
   */
  async getOrdersNeedingSync(shopId: string): Promise<any[]> {
    try {
      const query = `
        SELECT
          so.order_id,
          so.service_id,
          so.customer_address,
          so.shop_id,
          so.total_amount,
          so.booking_date,
          so.booking_time_slot,
          so.booking_end_time,
          ss.service_name,
          ss.service_description,
          c.customer_name,
          c.email as customer_email,
          c.phone_number as customer_phone
        FROM service_orders so
        INNER JOIN shop_services ss ON so.service_id = ss.service_id
        LEFT JOIN customers c ON so.customer_address = c.wallet_address
        WHERE so.shop_id = $1
          AND so.status IN ('paid', 'completed')
          AND so.calendar_sync_status = 'not_synced'
          AND so.booking_date IS NOT NULL
          AND so.booking_time_slot IS NOT NULL
        ORDER BY so.booking_date ASC, so.booking_time_slot ASC
      `;

      const result = await this.pool.query(query, [shopId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting orders needing sync:', error);
      throw error;
    }
  }

  /**
   * Map database row to CalendarConnection interface
   */
  private mapToCalendarConnection(row: any): CalendarConnection {
    return {
      id: row.id,
      shopId: row.shop_id,
      provider: row.provider,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiry: new Date(row.token_expiry),
      calendarId: row.calendar_id,
      googleAccountEmail: row.google_account_email,
      isActive: row.is_active,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
      lastSyncStatus: row.last_sync_status,
      syncErrorMessage: row.sync_error_message,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
