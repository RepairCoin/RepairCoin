// backend/src/domains/AdsDomain/repositories/BillingPlanRepository.ts
//
// One ad-management plan per shop (Q4/Q7). Plan B is the default go-to-market, so
// a shop with no row is treated as Plan B with default terms (not inserted until
// an admin explicitly sets it).

import { BaseRepository } from '../../../repositories/BaseRepository';

export type AdPlanType = 'a' | 'b' | 'c';
export type PlanCModel = 'per_booking' | 'revenue_share';

export interface AdBillingPlan {
  shopId: string;
  planType: AdPlanType;
  markupBps: number;            // Plan B (2000 = 20%)
  dashboardFeeCents: number;    // Plan A
  perBookingFeeCents: number;   // Plan C
  revenueShareBps: number;      // Plan C alt
  planCModel: PlanCModel;
  active: boolean;
}

// Plan B, default terms — the implicit plan for a shop with no explicit row (Q7).
export const DEFAULT_PLAN: Omit<AdBillingPlan, 'shopId'> = {
  planType: 'b',
  markupBps: 2000,
  dashboardFeeCents: 29900,
  perBookingFeeCents: 5000,
  revenueShareBps: 1000,
  planCModel: 'per_booking',
  active: true,
};

export class BillingPlanRepository extends BaseRepository {
  async getPlan(shopId: string): Promise<AdBillingPlan | null> {
    const res = await this.pool.query(`SELECT * FROM ad_billing_plans WHERE shop_id = $1`, [shopId]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** The shop's plan, or the implicit Plan-B default (not persisted). */
  async getOrDefault(shopId: string): Promise<AdBillingPlan> {
    return (await this.getPlan(shopId)) ?? { shopId, ...DEFAULT_PLAN };
  }

  async upsertPlan(shopId: string, p: Partial<Omit<AdBillingPlan, 'shopId'>>): Promise<AdBillingPlan> {
    const d = DEFAULT_PLAN;
    const res = await this.pool.query(
      `INSERT INTO ad_billing_plans
         (shop_id, plan_type, markup_bps, dashboard_fee_cents, per_booking_fee_cents,
          revenue_share_bps, plan_c_model, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (shop_id) DO UPDATE SET
         plan_type             = EXCLUDED.plan_type,
         markup_bps            = EXCLUDED.markup_bps,
         dashboard_fee_cents   = EXCLUDED.dashboard_fee_cents,
         per_booking_fee_cents = EXCLUDED.per_booking_fee_cents,
         revenue_share_bps     = EXCLUDED.revenue_share_bps,
         plan_c_model          = EXCLUDED.plan_c_model,
         active                = EXCLUDED.active,
         updated_at            = now()
       RETURNING *`,
      [
        shopId,
        p.planType ?? d.planType,
        p.markupBps ?? d.markupBps,
        p.dashboardFeeCents ?? d.dashboardFeeCents,
        p.perBookingFeeCents ?? d.perBookingFeeCents,
        p.revenueShareBps ?? d.revenueShareBps,
        p.planCModel ?? d.planCModel,
        p.active ?? d.active,
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  /** All shops that have an active campaign — joined with their plan (default if none). */
  async listActiveShopPlans(): Promise<AdBillingPlan[]> {
    const res = await this.pool.query(
      `SELECT DISTINCT c.shop_id,
              p.plan_type, p.markup_bps, p.dashboard_fee_cents, p.per_booking_fee_cents,
              p.revenue_share_bps, p.plan_c_model, p.active
         FROM ad_campaigns c
         LEFT JOIN ad_billing_plans p ON p.shop_id = c.shop_id
        WHERE c.deleted_at IS NULL AND c.status = 'active'`
    );
    return res.rows.map((r) =>
      r.plan_type ? this.mapRow(r) : { shopId: r.shop_id, ...DEFAULT_PLAN }
    );
  }

  private mapRow(r: any): AdBillingPlan {
    return {
      shopId: r.shop_id,
      planType: r.plan_type,
      markupBps: r.markup_bps,
      dashboardFeeCents: r.dashboard_fee_cents,
      perBookingFeeCents: r.per_booking_fee_cents,
      revenueShareBps: r.revenue_share_bps,
      planCModel: r.plan_c_model,
      active: r.active,
    };
  }
}
