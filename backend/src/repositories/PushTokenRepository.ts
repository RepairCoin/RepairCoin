import { createHash } from 'crypto';
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface DevicePushToken {
  id: string;
  walletAddress: string;
  expoPushToken: string | null;
  deviceId: string | null;
  deviceType: 'ios' | 'android' | 'web';
  deviceName: string | null;
  appVersion: string | null;
  webPushSubscription: WebPushSubscription | null;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterTokenParams {
  walletAddress: string;
  expoPushToken?: string;
  deviceId?: string;
  deviceType: 'ios' | 'android' | 'web';
  deviceName?: string;
  appVersion?: string;
  webPushSubscription?: WebPushSubscription;
}

/**
 * Generate a synthetic expo_push_token for web subscriptions.
 * This satisfies the existing unique constraint on expo_push_token.
 */
function generateWebTokenId(endpoint: string): string {
  const hash = createHash('sha256').update(endpoint).digest('hex');
  return `web-push:${hash}`;
}

export class PushTokenRepository extends BaseRepository {
  /**
   * Register or update a push token for a device
   * Handles account switching: same device token can be reassigned to different users
   */
  async registerToken(params: RegisterTokenParams): Promise<DevicePushToken> {
    const { walletAddress, deviceId, deviceType, deviceName, appVersion } = params;
    const normalizedAddress = walletAddress.toLowerCase();

    try {
      if (deviceType === 'web') {
        return await this.registerWebToken(normalizedAddress, params);
      }

      // Mobile token registration (existing behavior)
      const { expoPushToken } = params;
      const query = `
        INSERT INTO device_push_tokens (
          wallet_address, expo_push_token, device_id, device_type, device_name, app_version, is_active, last_used_at
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
        ON CONFLICT (expo_push_token)
        DO UPDATE SET
          wallet_address = EXCLUDED.wallet_address,
          device_id = EXCLUDED.device_id,
          device_type = EXCLUDED.device_type,
          device_name = EXCLUDED.device_name,
          app_version = EXCLUDED.app_version,
          is_active = TRUE,
          last_used_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        normalizedAddress,
        expoPushToken,
        deviceId || null,
        deviceType,
        deviceName || null,
        appVersion || null,
      ]);

      logger.info('Push token registered', {
        walletAddress: normalizedAddress,
        deviceType,
        deviceId: deviceId?.substring(0, 10) + '...',
      });

      return this.mapSnakeToCamel(result.rows[0]) as DevicePushToken;
    } catch (error: any) {
      logger.error('Failed to register push token', { error: error.message, walletAddress: normalizedAddress });
      throw error;
    }
  }

  /**
   * Register a web push subscription token
   */
  private async registerWebToken(
    normalizedAddress: string,
    params: RegisterTokenParams
  ): Promise<DevicePushToken> {
    const { webPushSubscription, deviceId, deviceName, appVersion } = params;

    if (!webPushSubscription) {
      throw new Error('webPushSubscription is required for web device type');
    }

    const syntheticToken = generateWebTokenId(webPushSubscription.endpoint);

    // Enforce one web push row per wallet via the partial unique index
    // idx_push_tokens_wallet_web (see migration 102). Endpoint rotations
    // on the same wallet UPSERT this row instead of creating a new one.
    const query = `
      INSERT INTO device_push_tokens (
        wallet_address, expo_push_token, device_id, device_type, device_name, app_version,
        web_push_subscription, is_active, last_used_at
      ) VALUES ($1, $2, $3, 'web', $4, $5, $6, TRUE, NOW())
      ON CONFLICT (wallet_address) WHERE device_type = 'web'
      DO UPDATE SET
        expo_push_token = EXCLUDED.expo_push_token,
        device_name = EXCLUDED.device_name,
        app_version = EXCLUDED.app_version,
        web_push_subscription = EXCLUDED.web_push_subscription,
        is_active = TRUE,
        last_used_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      normalizedAddress,
      syntheticToken,
      deviceId || null,
      deviceName || null,
      appVersion || null,
      JSON.stringify(webPushSubscription),
    ]);

    logger.info('Web push token registered', {
      walletAddress: normalizedAddress,
      endpoint: webPushSubscription.endpoint.substring(0, 50) + '...',
    });

    return this.mapSnakeToCamel(result.rows[0]) as DevicePushToken;
  }

  /**
   * Get all active push tokens for a user
   * Optionally filter by device types
   */
  async getActiveTokensByWallet(walletAddress: string, deviceTypes?: string[]): Promise<DevicePushToken[]> {
    const normalizedAddress = walletAddress.toLowerCase();

    let query = `SELECT * FROM device_push_tokens
       WHERE wallet_address = $1 AND is_active = TRUE`;
    const queryParams: any[] = [normalizedAddress];

    if (deviceTypes && deviceTypes.length > 0) {
      query += ` AND device_type = ANY($2)`;
      queryParams.push(deviceTypes);
    }

    query += ` ORDER BY last_used_at DESC`;

    const result = await this.pool.query(query, queryParams);

    return result.rows.map((row) => this.mapSnakeToCamel(row) as DevicePushToken);
  }

  /**
   * Get active tokens for multiple users (batch operation)
   * Optionally filter by device types
   */
  async getActiveTokensForUsers(
    walletAddresses: string[],
    deviceTypes?: string[]
  ): Promise<Map<string, DevicePushToken[]>> {
    const normalizedAddresses = walletAddresses.map((addr) => addr.toLowerCase());

    let query = `SELECT * FROM device_push_tokens
       WHERE wallet_address = ANY($1) AND is_active = TRUE`;
    const queryParams: any[] = [normalizedAddresses];

    if (deviceTypes && deviceTypes.length > 0) {
      query += ` AND device_type = ANY($2)`;
      queryParams.push(deviceTypes);
    }

    query += ` ORDER BY wallet_address, last_used_at DESC`;

    const result = await this.pool.query(query, queryParams);

    const tokenMap = new Map<string, DevicePushToken[]>();
    for (const row of result.rows) {
      const token = this.mapSnakeToCamel(row) as DevicePushToken;
      const tokens = tokenMap.get(token.walletAddress) || [];
      tokens.push(token);
      tokenMap.set(token.walletAddress, tokens);
    }

    return tokenMap;
  }

  /**
   * Deactivate a specific push token
   * Called when Expo reports the token as invalid or web push returns 410 Gone
   */
  async deactivateToken(expoPushToken: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE device_push_tokens
       SET is_active = FALSE, updated_at = NOW()
       WHERE expo_push_token = $1 AND is_active = TRUE
       RETURNING id`,
      [expoPushToken]
    );

    if (result.rowCount && result.rowCount > 0) {
      logger.info('Push token deactivated', { token: expoPushToken.substring(0, 30) + '...' });
      return true;
    }
    return false;
  }

  /**
   * Deactivate a web push token by endpoint
   */
  async deactivateWebTokenByEndpoint(endpoint: string): Promise<boolean> {
    const syntheticToken = generateWebTokenId(endpoint);
    return this.deactivateToken(syntheticToken);
  }

  /**
   * Deactivate all tokens for a user
   * Called on logout or account deactivation
   */
  async deactivateAllForWallet(walletAddress: string): Promise<number> {
    const normalizedAddress = walletAddress.toLowerCase();

    const result = await this.pool.query(
      `UPDATE device_push_tokens
       SET is_active = FALSE, updated_at = NOW()
       WHERE wallet_address = $1 AND is_active = TRUE
       RETURNING id`,
      [normalizedAddress]
    );

    const count = result.rowCount || 0;
    if (count > 0) {
      logger.info('All push tokens deactivated for user', { walletAddress: normalizedAddress, count });
    }
    return count;
  }

  /**
   * Deactivate a specific token for a user
   * Called when user logs out from a specific device
   */
  async deactivateTokenForWallet(walletAddress: string, expoPushToken: string): Promise<boolean> {
    const normalizedAddress = walletAddress.toLowerCase();

    const result = await this.pool.query(
      `UPDATE device_push_tokens
       SET is_active = FALSE, updated_at = NOW()
       WHERE wallet_address = $1 AND expo_push_token = $2 AND is_active = TRUE
       RETURNING id`,
      [normalizedAddress, expoPushToken]
    );

    return (result.rowCount || 0) > 0;
  }

  /**
   * Update last_used_at timestamp
   * Called when a notification is successfully sent to the device
   */
  async updateLastUsed(expoPushToken: string): Promise<void> {
    await this.pool.query(
      `UPDATE device_push_tokens
       SET last_used_at = NOW(), updated_at = NOW()
       WHERE expo_push_token = $1`,
      [expoPushToken]
    );
  }

  /**
   * Get all active devices for a user
   * Used for showing "logged in devices" in settings
   */
  async getActiveDevices(walletAddress: string): Promise<DevicePushToken[]> {
    const normalizedAddress = walletAddress.toLowerCase();

    const result = await this.pool.query(
      `SELECT id, device_type, device_name, app_version, last_used_at, created_at
       FROM device_push_tokens
       WHERE wallet_address = $1 AND is_active = TRUE
       ORDER BY last_used_at DESC`,
      [normalizedAddress]
    );

    return result.rows.map((row) => this.mapSnakeToCamel(row) as DevicePushToken);
  }

  /**
   * Cleanup old inactive tokens
   * Should be run periodically (e.g., daily cron job)
   */
  async cleanupInactiveTokens(daysOld: number = 90): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM device_push_tokens
       WHERE is_active = FALSE
       AND updated_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [daysOld]
    );

    const count = result.rowCount || 0;
    if (count > 0) {
      logger.info(`Cleaned up ${count} inactive push tokens older than ${daysOld} days`);
    }
    return count;
  }

  /**
   * Get token count statistics
   * Used for admin dashboard
   */
  async getTokenStats(): Promise<{ totalActive: number; totalInactive: number; byPlatform: Record<string, number> }> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = TRUE) as total_active,
        COUNT(*) FILTER (WHERE is_active = FALSE) as total_inactive,
        COUNT(*) FILTER (WHERE is_active = TRUE AND device_type = 'ios') as ios_active,
        COUNT(*) FILTER (WHERE is_active = TRUE AND device_type = 'android') as android_active,
        COUNT(*) FILTER (WHERE is_active = TRUE AND device_type = 'web') as web_active
      FROM device_push_tokens
    `);

    const row = result.rows[0];
    return {
      totalActive: parseInt(row.total_active, 10),
      totalInactive: parseInt(row.total_inactive, 10),
      byPlatform: {
        ios: parseInt(row.ios_active, 10),
        android: parseInt(row.android_active, 10),
        web: parseInt(row.web_active, 10),
      },
    };
  }
}
