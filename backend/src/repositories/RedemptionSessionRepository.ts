import { BaseRepository } from './BaseRepository';
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
  qrCode?: string;
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
      const query = `
        INSERT INTO redemption_sessions (
          session_id, customer_address, shop_id, max_amount,
          status, created_at, expires_at, qr_code, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
        session.qrCode || null,
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
        qrCode: session.qrCode ? 'present' : 'null',
        metadata: session.metadata || {}
      });
      
      const result = await this.pool.query(query, values);
      return this.mapRowToSession(result.rows[0]);
    } catch (error: any) {
      logger.error('Error creating redemption session:', {
        error: error.message,
        code: error.code,
        detail: error.detail,
        stack: error.stack
      });
      throw new Error(`Failed to create redemption session: ${error.message}`);
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

  async updateSessionStatus(
    sessionId: string, 
    status: 'approved' | 'rejected' | 'used' | 'expired',
    signature?: string
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
      
      await this.pool.query(query, values);
      logger.info('Updated redemption session status', { sessionId, status });
    } catch (error) {
      logger.error('Error updating session status:', error);
      throw new Error('Failed to update session status');
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

  async getSessionByQRCode(qrCode: string): Promise<RedemptionSessionData | null> {
    try {
      const query = `
        SELECT * FROM redemption_sessions 
        WHERE qr_code = $1 
        AND status IN ('pending', 'approved')
        AND expires_at > NOW()
      `;
      
      const result = await this.pool.query(query, [qrCode]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      logger.error('Error getting session by QR code:', error);
      throw new Error('Failed to get session by QR code');
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

  private mapRowToSession(row: any): RedemptionSessionData {
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
      qrCode: row.qr_code,
      signature: row.signature,
      metadata: row.metadata
    };
  }
}