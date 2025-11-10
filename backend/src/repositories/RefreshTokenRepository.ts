// backend/src/repositories/RefreshTokenRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface RefreshToken {
  id: string;
  tokenId: string;
  userAddress: string;
  userRole: 'admin' | 'shop' | 'customer';
  shopId?: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
  revoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface CreateRefreshTokenParams {
  tokenId: string;
  userAddress: string;
  userRole: 'admin' | 'shop' | 'customer';
  shopId?: string;
  token: string; // The actual JWT token to hash
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export class RefreshTokenRepository extends BaseRepository {
  constructor() {
    super();
  }

  // Hash token for storage
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Create new refresh token
  async createRefreshToken(params: CreateRefreshTokenParams): Promise<RefreshToken> {
    try {
      const tokenHash = this.hashToken(params.token);

      const query = `
        INSERT INTO refresh_tokens (
          token_id, user_address, user_role, shop_id, token_hash,
          expires_at, user_agent, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        params.tokenId,
        params.userAddress.toLowerCase(),
        params.userRole,
        params.shopId || null,
        tokenHash,
        params.expiresAt,
        params.userAgent || null,
        params.ipAddress || null
      ];

      const result = await this.pool.query(query, values);
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error creating refresh token:', error);
      throw new Error('Failed to create refresh token');
    }
  }

  // Validate refresh token (check if exists, not revoked, not expired)
  async validateRefreshToken(tokenId: string, token: string): Promise<RefreshToken | null> {
    try {
      const tokenHash = this.hashToken(token);

      const query = `
        SELECT * FROM refresh_tokens
        WHERE token_id = $1 AND token_hash = $2 AND revoked = false
      `;

      const result = await this.pool.query(query, [tokenId, tokenHash]);

      if (result.rows.length === 0) {
        return null;
      }

      const refreshToken = this.mapSnakeToCamel(result.rows[0]);

      // Check if expired
      if (new Date(refreshToken.expiresAt) < new Date()) {
        logger.warn('Refresh token expired', { tokenId });
        return null;
      }

      return refreshToken;
    } catch (error) {
      logger.error('Error validating refresh token:', error);
      throw new Error('Failed to validate refresh token');
    }
  }

  // Update last used timestamp
  async updateLastUsed(tokenId: string): Promise<void> {
    try {
      const query = `
        UPDATE refresh_tokens
        SET last_used_at = NOW()
        WHERE token_id = $1
      `;

      await this.pool.query(query, [tokenId]);
    } catch (error) {
      logger.error('Error updating last used timestamp:', error);
      throw new Error('Failed to update last used timestamp');
    }
  }

  // Revoke single token
  async revokeToken(tokenId: string, reason?: string): Promise<void> {
    try {
      const query = `
        UPDATE refresh_tokens
        SET revoked = true, revoked_at = NOW(), revoked_reason = $2
        WHERE token_id = $1
      `;

      await this.pool.query(query, [tokenId, reason || 'User logout']);
      logger.info('Refresh token revoked', { tokenId, reason });
    } catch (error) {
      logger.error('Error revoking refresh token:', error);
      throw new Error('Failed to revoke refresh token');
    }
  }

  // Revoke all tokens for a user
  async revokeAllUserTokens(userAddress: string, reason?: string): Promise<number> {
    try {
      const query = `
        UPDATE refresh_tokens
        SET revoked = true, revoked_at = NOW(), revoked_reason = $2
        WHERE user_address = $1 AND revoked = false
        RETURNING id
      `;

      const result = await this.pool.query(query, [userAddress.toLowerCase(), reason || 'Logout all devices']);
      logger.info('Revoked all tokens for user', { userAddress, count: result.rowCount });
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error revoking all user tokens:', error);
      throw new Error('Failed to revoke all user tokens');
    }
  }

  // Revoke all tokens for a shop
  async revokeAllShopTokens(shopId: string, reason?: string): Promise<number> {
    try {
      const query = `
        UPDATE refresh_tokens
        SET revoked = true, revoked_at = NOW(), revoked_reason = $2
        WHERE shop_id = $1 AND revoked = false
        RETURNING id
      `;

      const result = await this.pool.query(query, [shopId, reason || 'Shop deactivated']);
      logger.info('Revoked all tokens for shop', { shopId, count: result.rowCount });
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error revoking all shop tokens:', error);
      throw new Error('Failed to revoke all shop tokens');
    }
  }

  // Get all active tokens for a user (for "active sessions" feature)
  async getActiveTokens(userAddress: string): Promise<RefreshToken[]> {
    try {
      const query = `
        SELECT * FROM refresh_tokens
        WHERE user_address = $1 AND revoked = false AND expires_at > NOW()
        ORDER BY last_used_at DESC
      `;

      const result = await this.pool.query(query, [userAddress.toLowerCase()]);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting active tokens:', error);
      throw new Error('Failed to get active tokens');
    }
  }

  // Cleanup expired tokens (cron job)
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const query = `
        DELETE FROM refresh_tokens
        WHERE expires_at < NOW() OR (revoked = true AND revoked_at < NOW() - INTERVAL '30 days')
        RETURNING id
      `;

      const result = await this.pool.query(query);
      const count = result.rowCount || 0;

      if (count > 0) {
        logger.info('Cleaned up expired/old refresh tokens', { count });
      }

      return count;
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
      throw new Error('Failed to cleanup expired tokens');
    }
  }

  // Get token statistics (for admin dashboard)
  async getTokenStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    revoked: number;
  }> {
    try {
      const query = `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE revoked = false AND expires_at > NOW()) as active,
          COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired,
          COUNT(*) FILTER (WHERE revoked = true) as revoked
        FROM refresh_tokens
      `;

      const result = await this.pool.query(query);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting token stats:', error);
      throw new Error('Failed to get token statistics');
    }
  }

  // Get all sessions with pagination (for admin session management)
  async getAllSessions(options: {
    page?: number;
    limit?: number;
    role?: 'admin' | 'shop' | 'customer';
    status?: 'active' | 'expired' | 'revoked' | 'all';
  } = {}): Promise<{
    sessions: (RefreshToken & { userName?: string; shopName?: string })[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (options.role) {
        conditions.push(`rt.user_role = $${paramIndex++}`);
        values.push(options.role);
      }

      if (options.status === 'active') {
        conditions.push(`rt.revoked = false AND rt.expires_at > NOW()`);
      } else if (options.status === 'expired') {
        conditions.push(`rt.expires_at <= NOW()`);
      } else if (options.status === 'revoked') {
        conditions.push(`rt.revoked = true`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM refresh_tokens rt ${whereClause}`;
      const countResult = await this.pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // Get sessions with user/shop names
      const query = `
        SELECT
          rt.*,
          COALESCE(c.name, s.name, a.name) as user_name,
          s.name as shop_name
        FROM refresh_tokens rt
        LEFT JOIN customers c ON rt.user_address = c.wallet_address AND rt.user_role = 'customer'
        LEFT JOIN shops s ON rt.user_address = s.wallet_address AND rt.user_role = 'shop'
        LEFT JOIN admins a ON rt.user_address = a.wallet_address AND rt.user_role = 'admin'
        ${whereClause}
        ORDER BY rt.last_used_at DESC NULLS LAST, rt.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      values.push(limit, offset);
      const result = await this.pool.query(query, values);

      const sessions = result.rows.map(row => {
        const mapped = this.mapSnakeToCamel(row);
        return {
          ...mapped,
          userName: row.user_name,
          shopName: row.shop_name
        };
      });

      return {
        sessions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting all sessions:', error);
      throw new Error('Failed to get all sessions');
    }
  }
}
