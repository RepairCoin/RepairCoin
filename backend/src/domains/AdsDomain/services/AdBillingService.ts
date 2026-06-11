// backend/src/domains/AdsDomain/services/AdBillingService.ts
//
// Q4/Q7 — accrues FixFlow ad-management revenue per the shop's plan. Runs nightly
// (folded into SafeguardScheduler). Plan B/C accrue per campaign per day from
// ad_performance_daily; Plan A accrues a flat monthly dashboard fee per shop.
//
// This computes what is OWED. Actually charging it (Stripe invoice) is a separate,
// flag-gated step (AdBillingStripeService) — see that file.

import { logger } from '../../../utils/logger';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { PerformanceRepository, PerformanceRow } from '../repositories/PerformanceRepository';
import { BillingPlanRepository, AdBillingPlan } from '../repositories/BillingPlanRepository';
import { BillingChargeRepository, ChargeType } from '../repositories/BillingChargeRepository';

export interface DayCharge {
  chargeType: ChargeType;
  basisCents: number;   // spend / revenue the charge derived from (or booking count for plan_c_booking)
  amountCents: number;  // FixFlow revenue
}

export class AdBillingService {
  constructor(
    private readonly campaigns = new CampaignRepository(),
    private readonly perf = new PerformanceRepository(),
    private readonly plans = new BillingPlanRepository(),
    private readonly charges = new BillingChargeRepository()
  ) {}

  /** PURE — one campaign-day's charge for a plan, or null if nothing is owed.
   *  Plan A is per-shop monthly (handled by accrueMonthlyDashboard), so returns null here. */
  static computeCampaignDayCharge(plan: AdBillingPlan, day: PerformanceRow): DayCharge | null {
    if (plan.planType === 'b') {
      const amount = Math.round((day.spendCents * plan.markupBps) / 10000);
      if (amount <= 0) return null;
      return { chargeType: 'plan_b_margin', basisCents: day.spendCents, amountCents: amount };
    }
    if (plan.planType === 'c') {
      if (plan.planCModel === 'revenue_share') {
        const amount = Math.round((day.revenueCents * plan.revenueShareBps) / 10000);
        if (amount <= 0) return null;
        return { chargeType: 'plan_c_revenue_share', basisCents: day.revenueCents, amountCents: amount };
      }
      const amount = day.bookingsCreated * plan.perBookingFeeCents;
      if (amount <= 0) return null;
      return { chargeType: 'plan_c_booking', basisCents: day.bookingsCreated, amountCents: amount };
    }
    return null; // plan A — no per-campaign accrual
  }

  /** Accrue Plan B/C charges for every active campaign over the last `windowDays`. */
  async accrue(windowDays = 3): Promise<number> {
    const active = await this.campaigns.listActive();
    const planCache = new Map<string, AdBillingPlan>();
    let written = 0;

    for (const c of active) {
      let plan = planCache.get(c.shopId);
      if (!plan) { plan = await this.plans.getOrDefault(c.shopId); planCache.set(c.shopId, plan); }
      if (!plan.active || plan.planType === 'a') continue;

      const rows = await this.perf.getDailyRows(c.id, windowDays);
      for (const day of rows) {
        const charge = AdBillingService.computeCampaignDayCharge(plan, day);
        if (!charge) continue;
        await this.charges.upsert({
          shopId: c.shopId, campaignId: c.id, periodDate: day.date,
          chargeType: charge.chargeType, basisCents: charge.basisCents, amountCents: charge.amountCents,
        });
        written++;
      }
    }
    return written;
  }

  /** Plan A flat dashboard fee — one charge per shop per month. `monthStart` is the
   *  first day of the billing month (YYYY-MM-01), passed in (no Date.now in scripts). */
  async accrueMonthlyDashboard(monthStart: string): Promise<number> {
    const shopPlans = await this.plans.listActiveShopPlans();
    let written = 0;
    for (const plan of shopPlans) {
      if (!plan.active || plan.planType !== 'a' || plan.dashboardFeeCents <= 0) continue;
      await this.charges.upsert({
        shopId: plan.shopId, campaignId: null, periodDate: monthStart,
        chargeType: 'plan_a_dashboard', basisCents: 0, amountCents: plan.dashboardFeeCents,
      });
      written++;
    }
    return written;
  }

  async getShopBilling(shopId: string) {
    const [plan, totals, recent] = await Promise.all([
      this.plans.getOrDefault(shopId),
      this.charges.getShopTotals(shopId),
      this.charges.listByShop(shopId, 60),
    ]);
    return { plan, totals, recent };
  }

  async getAllShopsBilling() {
    return this.charges.getAllShopsTotals();
  }

  /** Best-effort nightly entry point — accrues B/C daily + Plan A for the given month. */
  async runNightly(monthStart: string): Promise<void> {
    try {
      const bc = await this.accrue(3);
      const a = await this.accrueMonthlyDashboard(monthStart);
      if (bc + a > 0) logger.info(`Ad billing accrual: ${bc} campaign-day + ${a} dashboard charge(s)`);
    } catch (err) {
      logger.error('AdBillingService.runNightly failed', err);
    }
  }
}

export const adBillingService = new AdBillingService();
