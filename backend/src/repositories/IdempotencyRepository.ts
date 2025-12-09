import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';
import crypto from 'crypto';

interface IdempotencyRecord {
  id: number;
  idempotencyKey: string;
  shopId: string;
  endpoint: string;
  requestHash: string | null;
  responseStatus: number;
  responseBody: any;
  createdAt: string;
  expiresAt: string;
}

interface StoredResponse {
  status: number;
  body: any;
}

export class IdempotencyRepository extends BaseRepository {
  private static instance: IdempotencyRepository;

  private constructor() {
    super();
  }

  public static getInstance(): IdempotencyRepository {
    if (!IdempotencyRepository.instance) {
      IdempotencyRepository.instance = new IdempotencyRepository();
    }
    return IdempotencyRepository.instance;
  }

  /**
   * Generate SHA256 hash of request body for conflict detection
   */
  public hashRequestBody(body: any): string {
    const normalized = JSON.stringify(body, Object.keys(body).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Check if an idempotency key exists and return the stored response
   * Returns null if key doesn't exist or is expired
   */
  async getExistingResponse(
    idempotencyKey: string,
    shopId: string,
    endpoint: string = 'issue-reward'
  ): Promise<StoredResponse | null> {
    try {
      const query = `
        SELECT response_status, response_body, request_hash
        FROM idempotency_keys
        WHERE idempotency_key = $1
          AND shop_id = $2
          AND endpoint = $3
          AND expires_at > NOW()
      `;

      const result = await this.pool.query(query, [idempotencyKey, shopId, endpoint]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        status: row.response_status,
        body: row.response_body
      };
    } catch (error) {
      logger.error('Error checking idempotency key:', error);
      // On error, allow the request to proceed (fail open)
      return null;
    }
  }

  /**
   * Check if idempotency key exists and validate request hash matches
   * Returns: { exists: boolean, response?: StoredResponse, hashMismatch?: boolean }
   */
  async checkIdempotencyKey(
    idempotencyKey: string,
    shopId: string,
    requestBody: any,
    endpoint: string = 'issue-reward'
  ): Promise<{ exists: boolean; response?: StoredResponse; hashMismatch?: boolean }> {
    try {
      const requestHash = this.hashRequestBody(requestBody);

      const query = `
        SELECT response_status, response_body, request_hash
        FROM idempotency_keys
        WHERE idempotency_key = $1
          AND shop_id = $2
          AND endpoint = $3
          AND expires_at > NOW()
      `;

      const result = await this.pool.query(query, [idempotencyKey, shopId, endpoint]);

      if (result.rows.length === 0) {
        return { exists: false };
      }

      const row = result.rows[0];

      // Check if request body hash matches (detect conflicting requests with same key)
      if (row.request_hash && row.request_hash !== requestHash) {
        logger.warn('Idempotency key reused with different request body', {
          idempotencyKey,
          shopId,
          endpoint,
          storedHash: row.request_hash,
          newHash: requestHash
        });
        return { exists: true, hashMismatch: true };
      }

      return {
        exists: true,
        response: {
          status: row.response_status,
          body: row.response_body
        }
      };
    } catch (error) {
      logger.error('Error checking idempotency key:', error);
      // On error, allow the request to proceed (fail open)
      return { exists: false };
    }
  }

  /**
   * Store a response for an idempotency key
   * TTL defaults to 24 hours
   */
  async storeResponse(
    idempotencyKey: string,
    shopId: string,
    requestBody: any,
    responseStatus: number,
    responseBody: any,
    endpoint: string = 'issue-reward',
    ttlHours: number = 24
  ): Promise<boolean> {
    try {
      const requestHash = this.hashRequestBody(requestBody);
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

      const query = `
        INSERT INTO idempotency_keys (
          idempotency_key, shop_id, endpoint, request_hash,
          response_status, response_body, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (idempotency_key, shop_id, endpoint)
        DO UPDATE SET
          response_status = EXCLUDED.response_status,
          response_body = EXCLUDED.response_body,
          expires_at = EXCLUDED.expires_at
      `;

      await this.pool.query(query, [
        idempotencyKey,
        shopId,
        endpoint,
        requestHash,
        responseStatus,
        JSON.stringify(responseBody),
        expiresAt.toISOString()
      ]);

      logger.debug('Stored idempotency response', {
        idempotencyKey,
        shopId,
        endpoint,
        responseStatus
      });

      return true;
    } catch (error) {
      logger.error('Error storing idempotency response:', error);
      // Don't fail the request if we can't store idempotency
      return false;
    }
  }

  /**
   * Clean up expired idempotency keys
   * Should be called periodically (e.g., via cron job)
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await this.pool.query(
        'DELETE FROM idempotency_keys WHERE expires_at < NOW()'
      );

      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired idempotency keys`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up idempotency keys:', error);
      return 0;
    }
  }
}

export const idempotencyRepository = IdempotencyRepository.getInstance();
