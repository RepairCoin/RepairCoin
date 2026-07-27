// backend/src/domains/AdsDomain/controllers/SubscriptionController.ts
//
// Shop self-serve ads subscription (lifecycle Phase 4, decision #5). Change tier
// (upgrade now / downgrade next cycle) and cancel — no admin approval. View current
// tier, status, and change history.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import {
  BillingPlanRepository, FlatTierName, FLAT_TIER_FEES, TIER_LIMITS,
} from '../repositories/BillingPlanRepository';
import { PlanChangeRepository } from '../repositories/PlanChangeRepository';
import { SubscriptionService } from '../services/SubscriptionService';

const plans = new BillingPlanRepository();
const changes = new PlanChangeRepository();
const subscriptions = new SubscriptionService();

const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;

// The full tier catalog (fee + inclusions), sent with every subscription read so the shop's plan
// panel can render a comparison of what each tier includes — the capability data lives HERE
// (TIER_LIMITS is what billing actually enforces), not duplicated in the frontend, so the two can't
// drift. Ordered cheapest → richest for display.
const ADS_TIER_ORDER: FlatTierName[] = ['starter', 'growth', 'business'];
const adsTierCatalog = () =>
  ADS_TIER_ORDER.map((name) => ({
    name,
    feeCents: FLAT_TIER_FEES[name],
    maxCampaigns: TIER_LIMITS[name].maxCampaigns,
    channels: TIER_LIMITS[name].channels,
    aiAutoAnswer: TIER_LIMITS[name].aiAutoAnswer,
  }));

// GET /shop/subscription
export async function getMySubscription(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    // getPlan (NOT getOrDefault) — a shop with no real row is NOT subscribed (tier=null),
    // so the self-serve subscribe form shows instead of a fabricated Growth default.
    const [plan, history, adsAccountConnected] = await Promise.all([
      plans.getPlan(shopId), changes.listByShop(shopId, 20), plans.isAdsAccountConnected(shopId),
    ]);
    const subscribed = !!plan && plan.planType === 'flat';
    res.json({
      success: true,
      data: {
        tier: subscribed ? plan!.flatTierName : null,
        flatFeeCents: plan?.flatFeeCents ?? 0,
        subscriptionStatus: plan?.subscriptionStatus ?? 'active',
        billingStartedAt: plan?.billingStartedAt ?? null,
        adsAccountConnected,
        history,
        tiers: adsTierCatalog(),
      },
    });
  } catch (err) {
    logger.error('SubscriptionController.getMySubscription failed', err);
    res.status(500).json({ success: false, error: 'Failed to load subscription' });
  }
}

// POST /shop/subscription/change { tier }
export async function changeMyTier(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  const tier = req.body?.tier as FlatTierName;
  if (!['starter', 'growth', 'business'].includes(tier)) {
    res.status(400).json({ success: false, error: "tier must be 'starter', 'growth' or 'business'" }); return;
  }
  try {
    const result = await subscriptions.setTier(shopId, tier, 'shop');
    if (result.error === 'no_payment_method') {
      res.status(402).json({ success: false, error: 'no_payment_method', message: 'Add a payment method before subscribing to an ads plan.' });
      return;
    }
    if (result.error) { res.status(400).json({ success: false, error: result.error }); return; }
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('SubscriptionController.changeMyTier failed', err);
    res.status(500).json({ success: false, error: 'Failed to change plan' });
  }
}

// POST /shop/subscription/cancel
export async function cancelMySubscription(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    await subscriptions.cancel(shopId, 'shop');
    res.json({ success: true });
  } catch (err) {
    logger.error('SubscriptionController.cancelMySubscription failed', err);
    res.status(500).json({ success: false, error: 'Failed to cancel' });
  }
}
