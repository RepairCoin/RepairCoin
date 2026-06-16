// backend/src/domains/AdsDomain/services/SubscriptionService.ts
//
// Lifecycle Phase 4 — the ads subscription (tier) money core. Self-serve tier changes
// (decision #5): upgrades apply immediately + prorated (decision #1); downgrades are
// scheduled to the next cycle (§9.7 supersedes a pending one); cancel pauses campaigns
// (§9.3). A saved card is required (§9.1). Real Stripe collection stays gated
// (ADS_BILLING_STRIPE_ENABLED) — proration is recorded regardless.

import { logger } from '../../../utils/logger';
import { BillingPlanRepository, FLAT_TIER_FEES, limitsForTier, FlatTierName } from '../repositories/BillingPlanRepository';
import { PlanChangeRepository } from '../repositories/PlanChangeRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { AdMessageRepository } from '../repositories/AdMessageRepository';
import { getStripeService } from '../../../services/StripeService';
import { getSharedPool } from '../../../utils/database-pool';
import { shopRepository } from '../../../repositories';

const TIER_RANK: Record<FlatTierName, number> = { starter: 0, growth: 1, business: 2 };
export type TierChangeKind = 'upgrade' | 'downgrade' | 'none';

export class SubscriptionService {
  constructor(
    private readonly plans = new BillingPlanRepository(),
    private readonly changes = new PlanChangeRepository(),
    private readonly campaigns = new CampaignRepository(),
    private readonly messages = new AdMessageRepository()
  ) {}

  // ---- PURE helpers (unit-tested) ----

  /** Classify a tier transition. A null/unknown 'from' (no tier yet) → upgrade. */
  static classifyChange(fromTier: string | null | undefined, toTier: FlatTierName): TierChangeKind {
    const from = fromTier && fromTier in TIER_RANK ? TIER_RANK[fromTier as FlatTierName] : -1;
    const to = TIER_RANK[toTier];
    if (to > from) return 'upgrade';
    if (to < from) return 'downgrade';
    return 'none';
  }

  /** Prorated upgrade charge for the remainder of the cycle (cents). Never negative. */
  static proratedUpgradeChargeCents(oldFeeCents: number, newFeeCents: number, daysRemaining: number, daysInCycle: number): number {
    if (daysInCycle <= 0) return 0;
    const diff = newFeeCents - oldFeeCents;
    return Math.max(0, Math.round((diff * daysRemaining) / daysInCycle));
  }

  // ---- IO ----

  /** §9.1 — does the shop have a saved card? Reads the local stripe_payment_methods
   *  table (populated when the shop adds a card via PaymentMethodsTab) — `shops` has no
   *  customer column, and this avoids a live Stripe round-trip. */
  private async hasCard(shopId: string): Promise<boolean> {
    try {
      const res = await getSharedPool().query(`SELECT 1 FROM stripe_payment_methods WHERE shop_id = $1 LIMIT 1`, [shopId]);
      return res.rows.length > 0;
    } catch (err) {
      logger.error('SubscriptionService.hasCard failed', err);
      return false;
    }
  }

  /** Resolve the shop's Stripe customer id for charging (mirrors AdBillingStripeService). */
  private async resolveCustomerId(shopId: string): Promise<string | null> {
    const shop = await shopRepository.getShop(shopId).catch(() => null);
    if ((shop as any)?.stripeCustomerId) return (shop as any).stripeCustomerId;
    const res = await getSharedPool().query(`SELECT stripe_customer_id FROM stripe_customers WHERE shop_id = $1 LIMIT 1`, [shopId]);
    return res.rows[0]?.stripe_customer_id ?? null;
  }

  private firstOfNextMonth(now = new Date()): Date {
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  private daysInThisCycle(now = new Date()): { remaining: number; total: number } {
    const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); // days in month
    const remaining = total - now.getDate() + 1;
    return { remaining, total };
  }

  /** Self-serve set/change tier. Returns { status, ... } describing what happened. */
  async setTier(shopId: string, toTier: FlatTierName, requestedBy = 'shop'): Promise<{
    outcome: 'unchanged' | 'upgraded' | 'downgrade_scheduled'; effectiveAt?: Date; proratedAmountCents?: number; error?: string;
  }> {
    if (!(toTier in TIER_RANK)) return { outcome: 'unchanged', error: 'invalid tier' };
    if (!(await this.hasCard(shopId))) return { outcome: 'unchanged', error: 'no_payment_method' };

    // getPlan (NOT getOrDefault) — no row = not subscribed (fromTier null), so subscribing
    // to any tier is correctly classified as an upgrade rather than a no-op vs. the default.
    const plan = await this.plans.getPlan(shopId);
    const fromTier = plan && plan.planType === 'flat' ? plan.flatTierName : null;
    const kind = SubscriptionService.classifyChange(fromTier, toTier);
    if (kind === 'none') return { outcome: 'unchanged' };

    // A new change always supersedes a pending scheduled one (§9.7).
    await this.changes.cancelScheduledForShop(shopId);

    if (kind === 'upgrade') {
      // Apply now. Prorate only if already billing (has a live campaign) and had a prior tier.
      let prorated = 0;
      if (fromTier && plan?.billingStartedAt) {
        const { remaining, total } = this.daysInThisCycle();
        prorated = SubscriptionService.proratedUpgradeChargeCents(FLAT_TIER_FEES[fromTier as FlatTierName] ?? 0, FLAT_TIER_FEES[toTier], remaining, total);
        if (prorated > 0) await this.chargeProration(shopId, prorated, toTier);
      }
      await this.plans.upsertPlan(shopId, { planType: 'flat', flatTierName: toTier, flatFeeCents: FLAT_TIER_FEES[toTier], active: true });
      await this.plans.setSubscriptionStatus(shopId, 'active');
      await this.changes.record({ shopId, fromTier, toTier, kind: 'upgrade', status: 'applied', proratedAmountCents: prorated, requestedBy });
      void this.event(shopId, `Plan changed to ${toTier}${prorated > 0 ? ` (prorated $${(prorated / 100).toFixed(2)} charged)` : ''}.`);
      return { outcome: 'upgraded', proratedAmountCents: prorated };
    }

    // downgrade → schedule for next cycle (no mid-cycle disruption; #1/#3)
    const effectiveAt = this.firstOfNextMonth();
    await this.changes.record({ shopId, fromTier, toTier, kind: 'downgrade', status: 'scheduled', effectiveAt, requestedBy });
    void this.event(shopId, `Downgrade to ${toTier} scheduled for ${effectiveAt.toISOString().slice(0, 10)} (end of the current cycle).`);
    return { outcome: 'downgrade_scheduled', effectiveAt };
  }

  /** §9.3 cancel — pause campaigns (which stops accrual), mark cancelled. No refund. */
  async cancel(shopId: string, requestedBy = 'shop'): Promise<void> {
    const active = await this.campaigns.list({ shopId, status: 'active' });
    for (const c of active.items) await this.campaigns.update(c.id, { status: 'paused' });
    await this.plans.setSubscriptionStatus(shopId, 'cancelled');
    await this.changes.record({ shopId, fromTier: null, toTier: null, kind: 'cancel', status: 'applied', requestedBy });
    void this.event(shopId, 'Ads subscription cancelled — campaigns paused. No further charges.');
  }

  /** Nightly — apply scheduled downgrades that are due; pause overflow campaigns (#3). */
  async applyDueScheduledChanges(asOf = new Date()): Promise<number> {
    const due = await this.changes.listDueScheduled(asOf);
    let applied = 0;
    for (const ch of due) {
      try {
        if (!ch.toTier) { await this.changes.markApplied(ch.id); continue; }
        await this.plans.upsertPlan(ch.shopId, { planType: 'flat', flatTierName: ch.toTier, flatFeeCents: FLAT_TIER_FEES[ch.toTier as FlatTierName] ?? 0, active: true });
        await this.changes.markApplied(ch.id);
        // #3 overflow: if now over the new tier's campaign limit, pause the newest excess (keep the oldest).
        const max = limitsForTier(ch.toTier).maxCampaigns;
        const list = await this.campaigns.list({ shopId: ch.shopId, status: 'active' });
        const overflow = list.items.slice(0, Math.max(0, list.items.length - max)); // list() is newest-first → these are newest
        for (const c of overflow) await this.campaigns.update(c.id, { status: 'paused' });
        void this.event(ch.shopId, `Downgrade to ${ch.toTier} applied.${overflow.length ? ` ${overflow.length} campaign(s) paused to fit the new limit — reactivate the one you want to keep.` : ''}`);
        applied++;
      } catch (err) {
        logger.error(`SubscriptionService: failed to apply scheduled change ${ch.id}`, err);
      }
    }
    return applied;
  }

  private async chargeProration(shopId: string, cents: number, toTier: string): Promise<void> {
    if (process.env.ADS_BILLING_STRIPE_ENABLED !== 'true') return; // recorded in plan_changes regardless
    try {
      const customerId = await this.resolveCustomerId(shopId);
      if (!customerId) return;
      await getStripeService().createImmediateInvoice(customerId, [{ amountCents: cents, description: `AI Ads — prorated upgrade to ${toTier}` }], { shopId, kind: 'ads_proration' });
    } catch (err) {
      logger.error('SubscriptionService.chargeProration failed', err);
    }
  }

  private event(shopId: string, body: string) {
    return this.messages.postEvent(shopId, body).catch((e) => logger.error('SubscriptionService event failed', e));
  }
}

export const subscriptionService = new SubscriptionService();
