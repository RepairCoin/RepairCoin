// backend/src/repositories/CustomerMessagingCostRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface CustomerMessagingCostRow {
  shopId: string;
  conversationId?: string | null;
  customerAddress?: string | null;
  channel: 'sms' | 'whatsapp';
  aiCostCents: number;
  carrierCostCents: number;
}

export interface ShopMessagingCostTotals {
  aiCostCents: number;
  carrierCostCents: number;
  totalCents: number;
  replyCount: number;
}

/**
 * Ledger of off-app AI-reply costs (SMS/WhatsApp) — table `customer_messaging_costs` (migration 219).
 * One row per AI reply on an off-channel conversation. See D5 in the channel-expansion scope.
 */
export class CustomerMessagingCostRepository extends BaseRepository {
  async record(row: CustomerMessagingCostRow): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO customer_messaging_costs
           (shop_id, conversation_id, customer_address, channel, ai_cost_cents, carrier_cost_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          row.shopId,
          row.conversationId ?? null,
          row.customerAddress ?? null,
          row.channel,
          row.aiCostCents,
          row.carrierCostCents,
        ]
      );
    } catch (error) {
      logger.error('Error in CustomerMessagingCostRepository.record:', error);
      throw error;
    }
  }

  /** Per-shop totals (optionally since a date), for billing / who-pays analytics. */
  async getShopTotals(shopId: string, since?: Date): Promise<ShopMessagingCostTotals> {
    try {
      const params: any[] = [shopId];
      let sinceClause = '';
      if (since) {
        params.push(since);
        sinceClause = ` AND created_at >= $${params.length}`;
      }
      const result = await this.pool.query(
        `SELECT
           COALESCE(SUM(ai_cost_cents), 0)::float8       AS ai,
           COALESCE(SUM(carrier_cost_cents), 0)::float8  AS carrier,
           COUNT(*)::int                                 AS replies
         FROM customer_messaging_costs
         WHERE shop_id = $1${sinceClause}`,
        params
      );
      const r = result.rows[0] ?? {};
      const ai = Number(r.ai) || 0;
      const carrier = Number(r.carrier) || 0;
      return { aiCostCents: ai, carrierCostCents: carrier, totalCents: ai + carrier, replyCount: Number(r.replies) || 0 };
    } catch (error) {
      logger.error('Error in CustomerMessagingCostRepository.getShopTotals:', error);
      throw error;
    }
  }
}
