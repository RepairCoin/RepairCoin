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

  /** Admin rollup: every shop's current-month overage (name-joined) + the platform grand total.
   *  Ordered by billable amount desc. Used by the admin overage dashboard. */
  async getAllShopsMonthSummary(): Promise<{
    shops: Array<{ shopId: string; shopName: string | null; overageCostCents: number; amountCents: number; status: string }>;
    grandTotal: { overageCostCents: number; amountCents: number; shopCount: number };
  }> {
    try {
      const result = await this.pool.query(
        `SELECT c.shop_id, s.name AS shop_name, c.overage_cost_cents, c.amount_cents, c.status
           FROM ai_overage_charges c
           LEFT JOIN shops s ON c.shop_id = s.shop_id
          WHERE c.period_month = DATE_TRUNC('month', now())::date
          ORDER BY c.amount_cents DESC`
      );
      const shops = result.rows.map((r: any) => ({
        shopId: r.shop_id,
        shopName: r.shop_name ?? null,
        overageCostCents: Number(r.overage_cost_cents) || 0,
        amountCents: Number(r.amount_cents) || 0,
        status: r.status,
      }));
      const grandTotal = shops.reduce(
        (acc, s) => ({
          overageCostCents: acc.overageCostCents + s.overageCostCents,
          amountCents: acc.amountCents + s.amountCents,
          shopCount: acc.shopCount + 1,
        }),
        { overageCostCents: 0, amountCents: 0, shopCount: 0 }
      );
      return { shops, grandTotal };
    } catch (error) {
      logger.error('AiOverageChargeRepository.getAllShopsMonthSummary failed:', error);
      throw error;
    }
  }

  /** Pending overage rows for a shop from COMPLETED months (never the in-progress month, which is
   *  still accruing). These are what Slice 3 invoices. */
  async pendingForShop(shopId: string): Promise<Array<{ id: string; periodMonth: string; amountCents: number }>> {
    try {
      const r = await this.pool.query(
        `SELECT id, period_month, amount_cents
           FROM ai_overage_charges
          WHERE shop_id = $1 AND status = 'pending'
            AND period_month < DATE_TRUNC('month', now())::date
          ORDER BY period_month ASC`,
        [shopId]
      );
      return r.rows.map((row: any) => ({
        id: row.id,
        periodMonth: row.period_month instanceof Date ? row.period_month.toISOString().slice(0, 10) : String(row.period_month).slice(0, 10),
        amountCents: Number(row.amount_cents) || 0,
      }));
    } catch (error) {
      logger.error('AiOverageChargeRepository.pendingForShop failed:', error);
      throw error;
    }
  }

  /** Distinct shop ids that have completed-month pending overage — the monthly invoicing run's work list. */
  async listShopsWithPending(): Promise<string[]> {
    try {
      const r = await this.pool.query(
        `SELECT DISTINCT shop_id FROM ai_overage_charges
          WHERE status = 'pending' AND period_month < DATE_TRUNC('month', now())::date`
      );
      return r.rows.map((row: any) => row.shop_id);
    } catch (error) {
      logger.error('AiOverageChargeRepository.listShopsWithPending failed:', error);
      throw error;
    }
  }

  /** Move rows to invoiced/paid/void and stamp the Stripe invoice id. */
  async markStatus(ids: string[], status: 'invoiced' | 'paid' | 'void', stripeInvoiceId?: string): Promise<void> {
    if (ids.length === 0) return;
    try {
      await this.pool.query(
        `UPDATE ai_overage_charges
            SET status = $1, stripe_invoice_id = COALESCE($2, stripe_invoice_id), updated_at = now()
          WHERE id = ANY($3::uuid[])`,
        [status, stripeInvoiceId ?? null, ids]
      );
    } catch (error) {
      logger.error('AiOverageChargeRepository.markStatus failed:', error);
      throw error;
    }
  }

  /** Webhook reconciliation: mark all rows for a Stripe invoice as paid. */
  async markPaidByInvoiceId(stripeInvoiceId: string): Promise<number> {
    try {
      const r = await this.pool.query(
        `UPDATE ai_overage_charges SET status = 'paid', updated_at = now()
          WHERE stripe_invoice_id = $1 AND status <> 'paid'`,
        [stripeInvoiceId]
      );
      return r.rowCount ?? 0;
    } catch (error) {
      logger.error('AiOverageChargeRepository.markPaidByInvoiceId failed:', error);
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
