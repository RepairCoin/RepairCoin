import { BaseRepository } from './BaseRepository';
import { PoolClient } from 'pg';
import { logger } from '../utils/logger';

export interface RedemptionSessionData {
  sessionId: string;
  customerAddress: string;
  shopId: string;
  maxAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'used';
  createdAt: Date;
  expiresAt: Date;
  approvedAt?: Date;
  usedAt?: Date;
  signature?: string;
  metadata?: any;
}

export class RedemptionSessionRepository extends BaseRepository {
  async createSession(session: RedemptionSessionData): Promise<RedemptionSessionData> {
    try {
      // Validate required fields before database insert
      const requiredFields = {
        sessionId: session.sessionId,
        customerAddress: session.customerAddress,
        shopId: session.shopId,
        maxAmount: session.maxAmount,
        status: session.status,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      };
      
      const nullFields = Object.entries(requiredFields)
        .filter(([key, value]) => value === null || value === undefined)
        .map(([key]) => key);
        
      if (nullFields.length > 0) {
        throw new Error(`Required fields are null/undefined: ${nullFields.join(', ')}`);
      }
      // Note: The table has both 'id' (auto-increment) and 'session_id' columns
      // We don't insert 'id' as it's auto-generated
      const query = `
        INSERT INTO redemption_sessions (
          session_id, customer_address, shop_id, max_amount,
          status, created_at, expires_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const values = [
        session.sessionId,
        session.customerAddress.toLowerCase(),
        session.shopId,
        session.maxAmount,
        session.status,
        session.createdAt,
        session.expiresAt,
        JSON.stringify(session.metadata || {})
      ];
      
      // Debug logging to see exact values
      logger.info('Creating redemption session with values:', {
        sessionId: session.sessionId,
        customerAddress: session.customerAddress,
        shopId: session.shopId,
        maxAmount: session.maxAmount,
        status: session.status,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        metadata: session.metadata || {}
      });
      
      const result = await this.pool.query(query, values);
      return this.mapRowToSession(result.rows[0]);
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        column: error.column,
        table: error.table
      };
      
      logger.error('Error creating redemption session:', errorDetails);
      
      // Create a more specific error message
      let specificError = error.message;
      if (error.constraint && error.constraint.includes('not_null')) {
        specificError = `Null constraint violation: ${error.constraint} (column: ${error.column || 'unknown'})`;
      }
      
      throw new Error(`Database error: ${specificError}`);
    }
  }

  async getSession(sessionId: string): Promise<RedemptionSessionData | null> {
    try {
      const query = 'SELECT * FROM redemption_sessions WHERE session_id = $1';
      const result = await this.pool.query(query, [sessionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      logger.error('Error getting redemption session:', error);
      throw new Error('Failed to get redemption session');
    }
  }

  async getCustomerSessions(customerAddress: string): Promise<RedemptionSessionData[]> {
    try {
      const query = `
        SELECT * FROM redemption_sessions 
        WHERE customer_address = $1 
        ORDER BY created_at DESC
      `;
      
      const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
      return result.rows.map(row => this.mapRowToSession(row));
    } catch (error) {
      logger.error('Error getting customer sessions:', error);
      throw new Error('Failed to get customer sessions');
    }
  }

  async getActiveCustomerSessions(customerAddress: string): Promise<RedemptionSessionData[]> {
    try {
      const query = `
        SELECT * FROM redemption_sessions 
        WHERE customer_address = $1 
        AND (status IN ('pending', 'approved') OR expires_at > NOW())
        ORDER BY created_at DESC
      `;
      
      const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
      return result.rows.map(row => this.mapRowToSession(row));
    } catch (error) {
      logger.error('Error getting active customer sessions:', error);
      throw new Error('Failed to get active customer sessions');
    }
  }

  /**
   * Update session status - supports optional PoolClient for atomic transactions
   * @param sessionId Session ID to update
   * @param status New status
   * @param signature Optional signature (for 'approved' status)
   * @param client Optional PoolClient for transaction support
   */
  async updateSessionStatus(
    sessionId: string,
    status: 'approved' | 'rejected' | 'used' | 'expired',
    signature?: string,
    client?: PoolClient
  ): Promise<void> {
    try {
      let query: string;
      let values: any[];

      switch (status) {
        case 'approved':
          query = `
            UPDATE redemption_sessions
            SET status = $1, approved_at = NOW(), signature = $2
            WHERE session_id = $3
          `;
          values = [status, signature || null, sessionId];
          break;

        case 'used':
          query = `
            UPDATE redemption_sessions
            SET status = $1, used_at = NOW()
            WHERE session_id = $2
          `;
          values = [status, sessionId];
          break;

        default:
          query = `
            UPDATE redemption_sessions
            SET status = $1
            WHERE session_id = $2
          `;
          values = [status, sessionId];
      }

      // Use provided client for transaction support, or fall back to pool
      if (client) {
        await client.query(query, values);
      } else {
        await this.pool.query(query, values);
      }

      logger.info('Updated redemption session status', { sessionId, status });
    } catch (error) {
      logger.error('Error updating session status:', error);
      throw new Error('Failed to update session status');
    }
  }

  async updateSessionMetadata(sessionId: string, metadata: any): Promise<void> {
    try {
      const query = `
        UPDATE redemption_sessions 
        SET metadata = $1
        WHERE session_id = $2
      `;
      
      await this.pool.query(query, [JSON.stringify(metadata), sessionId]);
      logger.info('Updated redemption session metadata', { sessionId });
    } catch (error) {
      logger.error('Error updating session metadata:', error);
      throw new Error('Failed to update session metadata');
    }
  }

  async findPendingSessionForCustomer(
    customerAddress: string, 
    shopId: string
  ): Promise<RedemptionSessionData | null> {
    try {
      const query = `
        SELECT * FROM redemption_sessions 
        WHERE customer_address = $1 
        AND shop_id = $2 
        AND status = 'pending'
        AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [customerAddress.toLowerCase(), shopId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      logger.error('Error finding pending session:', error);
      throw new Error('Failed to find pending session');
    }
  }

  async expireOldSessions(): Promise<number> {
    try {
      const query = `
        UPDATE redemption_sessions 
        SET status = 'expired'
        WHERE status = 'pending' 
        AND expires_at < NOW()
        RETURNING session_id
      `;
      
      const result = await this.pool.query(query);
      const count = result.rowCount || 0;
      
      if (count > 0) {
        logger.info(`Expired ${count} redemption sessions`);
      }
      
      return count;
    } catch (error) {
      logger.error('Error expiring sessions:', error);
      throw new Error('Failed to expire sessions');
    }
  }


  async getShopPendingSessions(shopId: string): Promise<RedemptionSessionData[]> {
    try {
      const query = `
        SELECT * FROM redemption_sessions
        WHERE shop_id = $1
        AND status = 'pending'
        AND expires_at > NOW()
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [shopId]);
      return result.rows.map(row => this.mapRowToSession(row));
    } catch (error) {
      logger.error('Error getting shop pending sessions:', error);
      throw new Error('Failed to get shop pending sessions');
    }
  }

  /**
   * Count recent sessions created for a specific shop and customer within a time window
   * Used for rate limiting to prevent DoS attacks
   * @param shopId Shop ID
   * @param customerAddress Customer wallet address
   * @param minutes Time window in minutes
   * @returns Count of sessions created within the time window
   */
  async countRecentSessionsByShopForCustomer(
    shopId: string,
    customerAddress: string,
    minutes: number
  ): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM redemption_sessions
        WHERE shop_id = $1
        AND customer_address = $2
        AND created_at > NOW() - INTERVAL '1 minute' * $3
      `;

      const result = await this.pool.query(query, [
        shopId,
        customerAddress.toLowerCase(),
        minutes
      ]);

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error counting recent sessions for rate limiting:', {
        shopId,
        customerAddress,
        minutes,
        error
      });
      throw new Error('Failed to count recent sessions');
    }
  }

  /**
   * Atomically consume a session for redemption
   * Uses a single UPDATE query with all validation conditions to prevent TOCTOU vulnerabilities
   * @param sessionId Session ID to consume
   * @param shopId Shop ID (must match session)
   * @param amount Amount to redeem (must not exceed maxAmount)
   * @returns The consumed session data, or null if validation failed
   */
  async atomicConsumeSession(
    sessionId: string,
    shopId: string,
    amount: number
  ): Promise<RedemptionSessionData | null> {
    try {
      // Single atomic UPDATE with all validation conditions
      // This prevents TOCTOU race conditions by checking expiry AT THE MOMENT of update
      const query = `
        UPDATE redemption_sessions
        SET status = 'used',
            used_at = NOW()
        WHERE session_id = $1
          AND shop_id = $2
          AND status = 'approved'
          AND expires_at > NOW()
          AND used_at IS NULL
          AND max_amount >= $3
        RETURNING *
      `;

      const result = await this.pool.query(query, [sessionId, shopId, amount]);

      if (result.rowCount === 0) {
        // No rows updated - validation failed
        return null;
      }

      logger.info('Session atomically consumed', {
        sessionId,
        shopId,
        amount
      });

      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      logger.error('Error atomically consuming session:', {
        sessionId,
        shopId,
        amount,
        error
      });
      throw new Error('Failed to consume session atomically');
    }
  }

  private mapRowToSession(row: any): RedemptionSessionData {
    let metadata;
    try {
      metadata = row.metadata ? JSON.parse(row.metadata) : {};
    } catch (e) {
      metadata = {};
    }

    return {
      sessionId: row.session_id,
      customerAddress: row.customer_address,
      shopId: row.shop_id,
      maxAmount: parseFloat(row.max_amount),
      status: row.status,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      usedAt: row.used_at ? new Date(row.used_at) : undefined,
      signature: row.signature,
      metadata: metadata
    };
  }
}