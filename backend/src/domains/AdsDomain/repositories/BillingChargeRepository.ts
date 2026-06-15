// backend/src/domains/AdsDomain/repositories/BillingChargeRepository.ts
//
// Accrued FixFlow ad-management revenue (Q4/Q7). The nightly job upserts one row
// per (campaign, day, type) for Plan B/C and per (shop, month, type) for Plan A's
// flat fee. Upserts are idempotent so re-running the accrual is safe.

import { BaseRepository } from '../../../repositories/BaseRepository';

export type ChargeType =
  | 'plan_a_dashboard' | 'plan_b_margin' | 'plan_c_booking' | 'plan_c_revenue_share'
  | 'flat_tier_fee'; // the flat-tier monthly management fee (the only live model as of 2026-06-15)
export type ChargeStatus = 'pending' | 'invoiced' | 'paid' | 'void';

export interface UpsertChargeInput {
  shopId: string;
  campaignId: string | null;
  periodDate: string;    // YYYY-MM-DD
  chargeType: ChargeType;
  basisCents: number;
  amountCents: number;
}

export interface BillingCharge {
  id: string;
  shopId: string;
  campaignId: string | null;
  periodDate: string;
  chargeType: ChargeType;
  basisCents: number;
  amountCents: number;
  status: ChargeStatus;
  stripeInvoiceId: string | null;
  createdAt: Date;
}

export interface BillingTotals {
  pendingCents: number;
  invoicedCents: number;
  paidCents: number;
  totalCents: number;
}

export class BillingChargeRepository extends BaseRepository {
  /** Idempotent per the two partial-unique indexes (campaign rows vs shop/Plan-A rows). */
  async upsert(input: UpsertChargeInput): Promise<void> {
    const conflict = input.campaignId
      ? `(campaign_id, period_date, charge_type) WHERE campaign_id IS NOT NULL`
      : `(shop_id, period_date, charge_type) WHERE campaign_id IS NULL`;
    await this.pool.query(
      `INSERT INTO ad_billing_charges
         (shop_id, campaign_id, period_date, charge_type, basis_cents, amount_cents)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ${conflict} DO UPDATE SET
         basis_cents  = EXCLUDED.basis_cents,
         amount_cents = EXCLUDED.amount_cents,
         updated_at   = now()`,
      [input.shopId, input.campaignId, input.periodDate, input.chargeType, input.basisCents, input.amountCents]
    );
  }

  async listByShop(shopId: string, limit = 60): Promise<BillingCharge[]> {
    const res = await this.pool.query(
      `SELECT * FROM ad_billing_charges WHERE shop_id = $1 ORDER BY period_date DESC, created_at DESC LIMIT $2`,
      [shopId, limit]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async getShopTotals(shopId: string): Promise<BillingTotals> {
    const res = await this.pool.query(
      `SELECT
         COALESCE(SUM(amount_cents) FILTER (WHERE status = 'pending'),0)::int  AS pending,
         COALESCE(SUM(amount_cents) FILTER (WHERE status = 'invoiced'),0)::int AS invoiced,
         COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'),0)::int     AS paid,
         COALESCE(SUM(amount_cents),0)::int                                    AS total
       FROM ad_billing_charges WHERE shop_id = $1`,
      [shopId]
    );
    const r = res.rows[0];
    return { pendingCents: r.pending, invoicedCents: r.invoiced, paidCents: r.paid, totalCents: r.total };
  }

  /** Platform-wide accrued ad-management revenue (admin summary). */
  async getAllShopsTotals(): Promise<BillingTotals & { shopCount: number }> {
    const res = await this.pool.query(
      `SELECT
         COALESCE(SUM(amount_cents) FILTER (WHERE status = 'pending'),0)::int  AS pending,
         COALESCE(SUM(amount_cents) FILTER (WHERE status = 'invoiced'),0)::int AS invoiced,
         COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'),0)::int     AS paid,
         COALESCE(SUM(amount_cents),0)::int                                    AS total,
         COUNT(DISTINCT shop_id)::int                                          AS shops
       FROM ad_billing_charges`
    );
    const r = res.rows[0];
    return {
      pendingCents: r.pending, invoicedCents: r.invoiced, paidCents: r.paid,
      totalCents: r.total, shopCount: r.shops,
    };
  }

  /** Pending charges for a shop (what a Stripe invoice would bundle). */
  async pendingForShop(shopId: string): Promise<BillingCharge[]> {
    const res = await this.pool.query(
      `SELECT * FROM ad_billing_charges WHERE shop_id = $1 AND status = 'pending' ORDER BY period_date`,
      [shopId]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async markStatus(ids: string[], status: ChargeStatus, stripeInvoiceId?: string): Promise<void> {
    if (ids.length === 0) return;
    await this.pool.query(
      `UPDATE ad_billing_charges SET status = $1, stripe_invoice_id = COALESCE($2, stripe_invoice_id), updated_at = now()
       WHERE id = ANY($3::uuid[])`,
      [status, stripeInvoiceId ?? null, ids]
    );
  }

  private mapRow(r: any): BillingCharge {
    return {
      id: r.id,
      shopId: r.shop_id,
      campaignId: r.campaign_id,
      periodDate: r.period_date instanceof Date ? r.period_date.toISOString().slice(0, 10) : String(r.period_date),
      chargeType: r.charge_type,
      basisCents: r.basis_cents,
      amountCents: r.amount_cents,
      status: r.status,
      stripeInvoiceId: r.stripe_invoice_id,
      createdAt: r.created_at,
    };
  }
}
