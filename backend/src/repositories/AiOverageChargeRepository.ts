// backend/src/repositories/AiOverageChargeRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface AiOverageMonth {
  overageCostCents: number;
  amountCents: number;
  multiplier: number;
  status: string;
}

/**
 * Monthly AI Usage Overage accrual ledger (table ai_overage_charges, migration 225). T3.2 Slice 2.
 * One row per shop per month; SpendCapEnforcer accrues the marginal cost beyond the allowance and the
 * billable amount (Usage x3) accumulates here. Slice 3 invoices the pending rows.
 */
export class AiOverageChargeRepository extends BaseRepository {
  /**
   * Accrue `overageCostUsd` (the portion of a spend that fell beyond the allowance) into the current
   * month's row. Idempotent per (shop, month): accumulates the cost and recomputes
   * amount_cents = accumulated overage x multiplier. No-op for non-positive input.
   */
  async accrue(shopId: string, overageCostUsd: number, multiplier = 3): Promise<void> {
    if (!overageCostUsd || overageCostUsd <= 0) return;
    const cents = overageCostUsd * 100;
    try {
      await this.pool.query(
        `INSERT INTO ai_overage_charges (shop_id, period_month, overage_cost_cents, multiplier, amount_cents)
         VALUES ($1, DATE_TRUNC('month', now())::date, $2::numeric, $3::numeric, $2::numeric * $3::numeric)
         ON CONFLICT (shop_id, period_month) DO UPDATE SET
           overage_cost_cents = ai_overage_charges.overage_cost_cents + EXCLUDED.overage_cost_cents,
           amount_cents = (ai_overage_charges.overage_cost_cents + EXCLUDED.overage_cost_cents)
                          * ai_overage_charges.multiplier,
           updated_at = now()`,
        [shopId, cents, multiplier]
      );
    } catch (error) {
      logger.error('AiOverageChargeRepository.accrue failed:', error);
      throw error;
    }
  }

  /** The shop's current-month accrual, or null if none yet. */
  async getShopCurrentMonth(shopId: string): Promise<AiOverageMonth | null> {
    try {
      const r = await this.pool.query(
        `SELECT overage_cost_cents, amount_cents, multiplier, status
           FROM ai_overage_charges
          WHERE shop_id = $1 AND period_month = DATE_TRUNC('month', now())::date`,
        [shopId]
      );
      if (r.rows.length === 0) return null;
      const row = r.rows[0];
      return {
        overageCostCents: Number(row.overage_cost_cents) || 0,
        amountCents: Number(row.amount_cents) || 0,
        multiplier: Number(row.multiplier) || 3,
        status: row.status,
      };
    } catch (error) {
      logger.error('AiOverageChargeRepository.getShopCurrentMonth failed:', error);
      throw error;
    }
  }
}
