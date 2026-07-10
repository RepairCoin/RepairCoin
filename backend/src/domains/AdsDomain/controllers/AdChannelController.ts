// backend/src/domains/AdsDomain/controllers/AdChannelController.ts
//
// Multi-channel foundation (Google Ads plan, Slice 2). Reports which ad channels a shop can use,
// from its tier + connection state — drives the channel picker in the campaign brief. Pure local
// logic (no external API): Meta is available on every tier; Google requires the Business tier.
// Google `connected` is always false until the Google connect flow (Slice 1) ships.
// See docs/tasks/strategy/ads-system/ads-google-ads-implementation-plan.md (Slice 2 / BE-2).

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { BillingPlanRepository, limitsForTier } from '../repositories/BillingPlanRepository';
import { MetaConnectionRepository } from '../repositories/MetaConnectionRepository';
import { GoogleConnectionRepository } from '../repositories/GoogleConnectionRepository';

const plans = new BillingPlanRepository();
const metaConns = new MetaConnectionRepository();
const googleConns = new GoogleConnectionRepository();

// GET /shop/ad-channels (shop) — channel eligibility for the brief picker.
export async function getAdChannels(req: Request, res: Response): Promise<void> {
  const shopId = (req as any).user?.shopId;
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    const plan = await plans.getOrDefault(shopId);
    const channels = limitsForTier(plan.flatTierName).channels; // e.g. business → [...,'google']
    const [metaConn, googleConn] = await Promise.all([
      metaConns.getConnection(shopId).catch(() => null),
      googleConns.getConnection(shopId).catch(() => null),
    ]);
    const metaConnected = metaConn?.connected === true;
    const googleConnected = googleConn?.connected === true;
    const googleEligible = channels.includes('google');

    res.json({
      success: true,
      data: {
        meta: {
          eligible: channels.includes('facebook'), // every tier
          connected: metaConnected,
          reason: metaConnected ? 'ok' : 'not_connected',
        },
        google: {
          eligible: googleEligible,                              // Business tier only
          connected: googleConnected,                            // real connection state (Slice 1)
          reason: !googleEligible ? 'tier_locked' : googleConnected ? 'ok' : 'not_connected',
        },
      },
    });
  } catch (err) {
    logger.error('AdChannelController.getAdChannels failed', err);
    res.status(500).json({ success: false, error: 'Failed to load ad channels' });
  }
}
