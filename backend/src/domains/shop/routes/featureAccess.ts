import { Router, Request, Response } from 'express';
import { getShopTier } from '../../../utils/shopTier';
import { hasPaidMultiLocation } from '../../../utils/multiLocationEntitlement';
import { FEATURE_TIERS, effectiveTierAllows } from '../../../config/featureTiers';
import { logger } from '../../../utils/logger';

const router = Router();

// GET /api/shops/feature-access — the authenticated shop's tier + per-feature access map.
router.get('/', async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const tier = await getShopTier(shopId);

    const features: Record<string, boolean> = {};
    for (const feature of Object.keys(FEATURE_TIERS)) {
      // effectiveTierAllows honors rollout flags — a deferred feature (e.g. aiCampaignsAdvanced until
      // ENFORCE_CAMPAIGN_AUTOMATION_TIER flips) reads as allowed for all tiers, keeping the UI in step
      // with the backend route guard.
      features[feature] = effectiveTierAllows(tier, feature);
    }

    // Paid multi-location entitlement is stricter than the tier map (excludes trial): it gates the
    // shop-facing location switcher and customer-facing multi-branch exposure.
    const multiLocationActive = await hasPaidMultiLocation(shopId);

    res.json({ success: true, data: { tier, features, multiLocationActive } });
  } catch (error) {
    logger.error('Error resolving feature access:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve feature access' });
  }
});

export default router;
