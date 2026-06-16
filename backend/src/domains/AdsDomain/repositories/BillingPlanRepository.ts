// backend/src/domains/AdsDomain/repositories/BillingPlanRepository.ts
//
// One ad-management plan per shop (Q4/Q7). Plan B is the default go-to-market, so
// a shop with no row is treated as Plan B with default terms (not inserted until
// an admin explicitly sets it).

import { BaseRepository } from '../../../repositories/BaseRepository';

// 'flat' = the $199/$499/$999 flat-tier model (the ONLY model offered as of 2026-06-15;
// a/b/c are retired from the UI but kept for any dormant/legacy rows).
export type AdPlanType = 'a' | 'b' | 'c' | 'flat';
export type PlanCModel = 'per_booking' | 'revenue_share';
export type FlatTierName = 'starter' | 'growth' | 'business';

export interface AdBillingPlan {
  shopId: string;
  planType: AdPlanType;
  markupBps: number;            // Plan B (2000 = 20%) — legacy
  dashboardFeeCents: number;    // Plan A — legacy
  perBookingFeeCents: number;   // Plan C — legacy
  revenueShareBps: number;      // Plan C alt — legacy
  planCModel: PlanCModel;       // legacy
  flatFeeCents: number;         // flat tier — the monthly management fee
  flatTierName: string | null;  // 'starter' | 'growth' | 'business' (reporting/UX)
  billingStartedAt: Date | null; // when the tier fee first began (first live campaign), §9.2
  subscriptionStatus: 'active' | 'past_due' | 'paused' | 'cancelled'; // §9.1/§9.3
  active: boolean;
}

// Flat tier amounts (cents). Decision #3 (2026-06-15).
export const FLAT_TIER_FEES: Record<FlatTierName, number> = {
  starter: 19900,
  growth: 49900,
  business: 99900,
};

// Per-tier capacity + inclusions (lifecycle Phase 1). maxCampaigns is the capacity unit;
// v1 = 1 campaign = 1 ad set (one budget/audience) — see the lifecycle design §3.
export interface TierLimits {
  maxCampaigns: number;
  channels: string[];
  aiAutoAnswer: boolean;
}
export const TIER_LIMITS: Record<FlatTierName, TierLimits> = {
  starter:  { maxCampaigns: 1,  channels: ['facebook'],                       aiAutoAnswer: false },
  growth:   { maxCampaigns: 3,  channels: ['facebook', 'instagram'],          aiAutoAnswer: true  },
  business: { maxCampaigns: 10, channels: ['facebook', 'instagram', 'google'], aiAutoAnswer: true  },
};
/** Resolve a plan's tier to its limits, defaulting to Growth for legacy/unset rows. */
export const limitsForTier = (tier: string | null | undefined): TierLimits =>
  TIER_LIMITS[(tier as FlatTierName)] ?? TIER_LIMITS.growth;

// Default = flat / Growth (Decision #4: flat is the only offered model). A shop with
// no explicit row is treated as Growth until an admin sets a tier.
export const DEFAULT_PLAN: Omit<AdBillingPlan, 'shopId'> = {
  planType: 'flat',
  markupBps: 2000,
  dashboardFeeCents: 29900,
  perBookingFeeCents: 5000,
  revenueShareBps: 1000,
  planCModel: 'per_booking',
  flatFeeCents: FLAT_TIER_FEES.growth,
  flatTierName: 'growth',
  billingStartedAt: null,
  subscriptionStatus: 'active',
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
          revenue_share_bps, plan_c_model, flat_fee_cents, flat_tier_name, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (shop_id) DO UPDATE SET
         plan_type             = EXCLUDED.plan_type,
         markup_bps            = EXCLUDED.markup_bps,
         dashboard_fee_cents   = EXCLUDED.dashboard_fee_cents,
         per_booking_fee_cents = EXCLUDED.per_booking_fee_cents,
         revenue_share_bps     = EXCLUDED.revenue_share_bps,
         plan_c_model          = EXCLUDED.plan_c_model,
         flat_fee_cents        = EXCLUDED.flat_fee_cents,
         flat_tier_name        = EXCLUDED.flat_tier_name,
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
        p.flatFeeCents ?? d.flatFeeCents,
        p.flatTierName ?? d.flatTierName,
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
              p.revenue_share_bps, p.plan_c_model, p.flat_fee_cents, p.flat_tier_name,
              p.billing_started_at, p.subscription_status, p.active
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
      flatFeeCents: r.flat_fee_cents ?? 0,
      flatTierName: r.flat_tier_name ?? null,
      billingStartedAt: r.billing_started_at ?? null,
      subscriptionStatus: r.subscription_status ?? 'active',
      active: r.active,
    };
  }

  /** Stamp when the shop's tier fee first began (first live campaign, §9.2). Idempotent. */
  async markBillingStarted(shopId: string): Promise<void> {
    await this.pool.query(
      `UPDATE ad_billing_plans SET billing_started_at = COALESCE(billing_started_at, now()), updated_at = now()
       WHERE shop_id = $1`,
      [shopId]
    );
  }

  /** §9.1/§9.3 — set the subscription status (active/past_due/paused/cancelled). */
  async setSubscriptionStatus(shopId: string, status: AdBillingPlan['subscriptionStatus']): Promise<void> {
    await this.pool.query(
      `UPDATE ad_billing_plans SET subscription_status = $1, updated_at = now() WHERE shop_id = $2`,
      [status, shopId]
    );
  }

  /** §9.6 — is the shop's ad account connected? (campaign-go-live precondition) */
  async isAdsAccountConnected(shopId: string): Promise<boolean> {
    const res = await this.pool.query(`SELECT ads_account_connected FROM shops WHERE shop_id = $1`, [shopId]);
    return res.rows[0]?.ads_account_connected === true;
  }
  /** §9.6 — admin marks the shop's ad account connected/disconnected. */
  async setAdsAccountConnected(shopId: string, connected: boolean): Promise<void> {
    await this.pool.query(`UPDATE shops SET ads_account_connected = $1 WHERE shop_id = $2`, [connected, shopId]);
  }
}
