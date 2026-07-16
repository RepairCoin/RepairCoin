// backend/src/repositories/ShopSmsNumberRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

/**
 * Per-shop SMS number registry (table `shop_sms_numbers`, migration 218). Backs the D2
 * decision from the AI Auto-Replies multi-channel scope: each shop texts from / receives on
 * its own dedicated number so an inbound `To` unambiguously identifies the shop.
 *
 * The table is identical for Option A (platform-provisioned) and Option B (BYO/hosted); only
 * the WRITER (`assign`, called by a provisioning step) differs between them — which is the one
 * seam that waits on management's D2 answer. The READERS below are decision-independent.
 */
export interface ShopSmsNumber {
  id: string;
  shopId: string;
  smsNumber: string;
  provisioningMode: 'platform' | 'byo';
  status: 'active' | 'pending' | 'released';
  createdAt: Date;
  updatedAt: Date;
}

export class ShopSmsNumberRepository extends BaseRepository {
  /**
   * To→shop inbound routing: resolve the shop that owns an inbound number, or null if no shop
   * has claimed it. Only 'active' rows route.
   */
  async findShopIdByNumber(smsNumber: string): Promise<string | null> {
    try {
      const result = await this.pool.query(
        `SELECT shop_id FROM shop_sms_numbers
         WHERE sms_number = $1 AND status = 'active'
         LIMIT 1`,
        [smsNumber]
      );
      return result.rows.length > 0 ? result.rows[0].shop_id : null;
    } catch (error) {
      logger.error('Error in findShopIdByNumber:', error);
      throw error;
    }
  }

  /** The shop's active outbound number, or null when it has none (→ caller falls back to TWILIO_SMS_FROM). */
  async getActiveForShop(shopId: string): Promise<ShopSmsNumber | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM shop_sms_numbers
         WHERE shop_id = $1 AND status = 'active'
         LIMIT 1`,
        [shopId]
      );
      return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error in getActiveForShop:', error);
      throw error;
    }
  }

  /**
   * Assign a number to a shop. This is the D2-gated WRITER — a provisioning step calls it after
   * buying a Twilio number (Option A) or completing the LOA/hosted-SMS flow (Option B). Provided
   * now so the readers have a populated table to test against; the provisioning flow that invokes
   * it in production is a later slice.
   */
  async assign(
    shopId: string,
    smsNumber: string,
    provisioningMode: 'platform' | 'byo'
  ): Promise<ShopSmsNumber> {
    try {
      const result = await this.pool.query(
        `INSERT INTO shop_sms_numbers (shop_id, sms_number, provisioning_mode, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (sms_number)
           DO UPDATE SET shop_id = EXCLUDED.shop_id,
                         provisioning_mode = EXCLUDED.provisioning_mode,
                         status = 'active',
                         updated_at = now()
         RETURNING *`,
        [shopId, smsNumber, provisioningMode]
      );
      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error('Error in assign:', error);
      throw error;
    }
  }

  private mapRow(row: any): ShopSmsNumber {
    return {
      id: row.id,
      shopId: row.shop_id,
      smsNumber: row.sms_number,
      provisioningMode: row.provisioning_mode,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
