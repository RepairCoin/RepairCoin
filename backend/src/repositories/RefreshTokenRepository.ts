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
  location?: string;
  deviceId?: string;
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
  location?: string;
  deviceId?: string;
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
          expires_at, user_agent, ip_address, location, device_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        params.ipAddress || null,
        params.location || null,
        params.deviceId || null
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

  async isTokenRevoked(tokenId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `SELECT revoked, expires_at FROM refresh_tokens WHERE token_id = $1`,
        [tokenId]
      );

      if (result.rows.length === 0) return true;

      const row = result.rows[0];
      if (row.revoked) return true;
      if (new Date(row.expires_at) < new Date()) return true;
      return false;
    } catch (error) {
      // Fail open: access token is short-lived; a DB blip shouldn't log everyone out
      logger.error('Error checking token revocation:', error);
      return false;
    }
  }

  // Revoke single token
  async revokeToken(tokenId: string, reason?: string, revokedByAdmin: boolean = false): Promise<void> {
    try {
      const query = `
        UPDATE refresh_tokens
        SET revoked = true, revoked_at = NOW(), revoked_reason = $2, revoked_by_admin = $3
        WHERE token_id = $1
      `;

      await this.pool.query(query, [tokenId, reason || 'User logout', revokedByAdmin]);
      logger.info('Refresh token revoked', { tokenId, reason, revokedByAdmin });
    } catch (error) {
      logger.error('Error revoking refresh token:', error);
      throw new Error('Failed to revoke refresh token');
    }
  }

  // Revoke all tokens for a user
  async revokeAllUserTokens(userAddress: string, reason?: string, revokedByAdmin: boolean = false): Promise<number> {
    try {
      const query = `
        UPDATE refresh_tokens
        SET revoked = true, revoked_at = NOW(), revoked_reason = $2, revoked_by_admin = $3
        WHERE user_address = $1 AND revoked = false
        RETURNING id
      `;

      const result = await this.pool.query(query, [userAddress.toLowerCase(), reason || 'Logout all devices', revokedByAdmin]);
      logger.info('Revoked all tokens for user', { userAddress, count: result.rowCount, revokedByAdmin });
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error revoking all user tokens:', error);
      throw new Error('Failed to revoke all user tokens');
    }
  }

  // Revoke all tokens for a shop
  async revokeAllShopTokens(shopId: string, reason?: string, revokedByAdmin: boolean = true): Promise<number> {
    try {
      const query = `
        UPDATE refresh_tokens
        SET revoked = true, revoked_at = NOW(), revoked_reason = $2, revoked_by_admin = $3
        WHERE shop_id = $1 AND revoked = false
        RETURNING id
      `;

      const result = await this.pool.query(query, [shopId, reason || 'Shop deactivated', revokedByAdmin]);
      logger.info('Revoked all tokens for shop', { shopId, count: result.rowCount, revokedByAdmin });
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error revoking all shop tokens:', error);
      throw new Error('Failed to revoke all shop tokens');
    }
  }

  // Revoke prior active tokens for the same user + device, so a device keeps a
  // single active session. Called on login to supersede the old one.
  //
  // Prefers device_id (a stable per-browser-context id) so two contexts on the
  // same machine — e.g. normal + incognito, which share a user_agent — aren't
  // treated as the same device. Falls back to user_agent only when no device_id
  // is sent (older web clients, native apps).
  async revokeActiveByDevice(
    userAddress: string,
    deviceId: string | null | undefined,
    userAgent: string | null | undefined,
    reason: string = 'Superseded by new login on same device'
  ): Promise<number> {
    // Nothing to match on — don't revoke (avoids nuking every session on a
    // request that carries neither a device id nor a user agent).
    if (!deviceId && !userAgent) {
      return 0;
    }

    try {
      const query = deviceId
        ? `
        UPDATE refresh_tokens
        SET revoked = true, revoked_at = NOW(), revoked_reason = $3
        WHERE user_address = $1 AND device_id = $2 AND revoked = false
        RETURNING id
      `
        : `
        UPDATE refresh_tokens
        SET revoked = true, revoked_at = NOW(), revoked_reason = $3
        WHERE user_address = $1 AND device_id IS NULL AND user_agent = $2 AND revoked = false
        RETURNING id
      `;

      const matchValue = deviceId || userAgent;
      const result = await this.pool.query(query, [userAddress.toLowerCase(), matchValue, reason]);
      if (result.rowCount) {
        logger.info('Superseded prior same-device sessions on login', {
          userAddress, count: result.rowCount, matchedBy: deviceId ? 'device_id' : 'user_agent'
        });
      }
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error revoking prior same-device tokens:', error);
      throw new Error('Failed to revoke prior same-device tokens');
    }
  }

  // Active sessions deduped to the most-recent row per device. Keys off device_id
  // when present, falling back to user_agent, then token_id so distinct unknown
  // devices aren't merged.
  async getDistinctDeviceTokens(userAddress: string): Promise<RefreshToken[]> {
    try {
      const query = `
        SELECT * FROM (
          SELECT DISTINCT ON (COALESCE(device_id, user_agent, token_id)) *
          FROM refresh_tokens
          WHERE user_address = $1 AND revoked = false AND expires_at > NOW()
          ORDER BY COALESCE(device_id, user_agent, token_id), last_used_at DESC, created_at DESC
        ) d
        ORDER BY d.last_used_at DESC
      `;

      const result = await this.pool.query(query, [userAddress.toLowerCase()]);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting distinct-device tokens:', error);
      throw new Error('Failed to get active sessions');
    }
  }

  // Multi-account switching: the accounts THIS device has a live session for.
  // One row per user_address (the most-recently-used), so the switcher lists each
  // account once. Backs GET /auth/sessions and gates POST /auth/switch.
  async getDeviceSessions(deviceId: string): Promise<RefreshToken[]> {
    if (!deviceId) return [];
    try {
      const query = `
        SELECT DISTINCT ON (user_address) *
        FROM refresh_tokens
        WHERE device_id = $1 AND revoked = false AND expires_at > NOW()
        ORDER BY user_address, last_used_at DESC, created_at DESC
      `;
      const result = await this.pool.query(query, [deviceId]);
      return result.rows.map((row) => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting device sessions:', error);
      throw new Error('Failed to get device sessions');
    }
  }

  // Whether this device currently holds a live (unrevoked, unexpired) session for
  // the given account — the precondition for an instant switch to it.
  async hasLiveDeviceSession(deviceId: string, userAddress: string): Promise<boolean> {
    if (!deviceId) return false;
    try {
      const result = await this.pool.query(
        `SELECT 1 FROM refresh_tokens
         WHERE device_id = $1 AND user_address = $2 AND revoked = false AND expires_at > NOW()
         LIMIT 1`,
        [deviceId, userAddress.toLowerCase()]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking live device session:', error);
      return false;
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

      // Get sessions with user/shop names. Use LIMIT-1 scalar subqueries instead
      // of LEFT JOINs: the name tables can contain duplicate wallet_address rows
      // (e.g. duplicate admin records), and a JOIN would fan out — producing
      // multiple rows with the same rt.id and breaking unique React keys/paging.
      // Subqueries guarantee exactly one row per refresh token. Case-insensitive
      // for robustness against mixed-case stored addresses.
      const query = `
        SELECT
          rt.*,
          COALESCE(
            (SELECT name FROM customers WHERE LOWER(wallet_address) = LOWER(rt.user_address) LIMIT 1),
            (SELECT name FROM shops     WHERE LOWER(wallet_address) = LOWER(rt.user_address) LIMIT 1),
            (SELECT name FROM admins    WHERE LOWER(wallet_address) = LOWER(rt.user_address) LIMIT 1)
          ) as user_name,
          (SELECT name FROM shops WHERE LOWER(wallet_address) = LOWER(rt.user_address) LIMIT 1) as shop_name
        FROM refresh_tokens rt
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

  /**
   * Check if a user has had any tokens revoked by admin recently (within last X hours)
   * This prevents immediate re-authentication after admin revocation
   * Note: Only checks for admin-initiated revocations, NOT user logouts
   *
   * @param userAddress - The wallet address to check
   * @param withinHours - How many hours back to check (default: 1 hour)
   * @returns The most recent admin revocation info if found, null otherwise
   */
  async hasRecentRevocation(userAddress: string, withinHours: number = 1): Promise<{
    revokedAt: Date;
    reason: string;
    tokenId: string;
  } | null> {
    try {
      const query = `
        SELECT token_id, revoked_at, revoked_reason
        FROM refresh_tokens
        WHERE user_address = $1
          AND revoked = true
          AND revoked_by_admin = true
          AND revoked_at > NOW() - INTERVAL '${withinHours} hours'
        ORDER BY revoked_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [userAddress.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        revokedAt: row.revoked_at,
        reason: row.revoked_reason || 'Token revoked by admin',
        tokenId: row.token_id
      };
    } catch (error) {
      logger.error('Error checking recent revocation:', error);
      throw new Error('Failed to check recent revocation');
    }
  }
}
