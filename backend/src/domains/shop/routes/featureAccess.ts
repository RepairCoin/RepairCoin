import { Router, Request, Response } from 'express';
import { getShopTier } from '../../../utils/shopTier';
import { FEATURE_TIERS, tierAllowsFeature } from '../../../config/featureTiers';
import { logger } from '../../../utils/logger';

const router = Router();

// GET /api/shops/feature-access — the authenticated shop's tier + per-feature access map.
router.get('/', async (req: Request, res: Response) => {
  try {
    const shopId = req.user!.shopId!;
    const tier = await getShopTier(shopId);

    const features: Record<string, boolean> = {};
    for (const feature of Object.keys(FEATURE_TIERS)) {
      features[feature] = tierAllowsFeature(tier, feature);
    }

    res.json({ success: true, data: { tier, features } });
  } catch (error) {
    logger.error('Error resolving feature access:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve feature access' });
  }
});

export default router;
