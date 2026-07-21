import { Request, Response, NextFunction } from 'express';
import { getShopTier } from '../utils/shopTier';
import { tierAllowsFeature, effectiveTierAllows, getRequiredTier } from '../config/featureTiers';
import { getPlanByTier, SubscriptionTier } from '../config/subscriptionPlans';
import { logger } from '../utils/logger';

/** Standard tier guard: always enforces `feature`'s required tier. */
export function requireTier(feature: string) {
  return makeTierGuard(feature, tierAllowsFeature);
}

/** Rollout-aware tier guard: enforces ONLY when the feature's rollout flag is on (see
 *  ROLLOUT_GATED_FEATURES). Until then it passes through — lets us ship a gate on a currently-open
 *  feature dark and flip enforcement deliberately. Pairs with the feature-access map, which uses the
 *  same effectiveTierAllows so the UI and the guard agree. */
export function requireTierRollout(feature: string) {
  return makeTierGuard(feature, effectiveTierAllows);
}

function makeTierGuard(
  feature: string,
  allows: (tier: SubscriptionTier, feature: string) => boolean
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId =
        req.params.shopId || req.body?.shopId || (req as any).shopId || req.user?.shopId;

      if (!shopId) {
        return res.status(400).json({ success: false, error: 'Shop ID required', code: 'MISSING_SHOP_ID' });
      }

      const tier = await getShopTier(shopId);
      if (allows(tier, feature)) return next();

      const requiredTier = getRequiredTier(feature)!;
      return res.status(403).json({
        success: false,
        error: `This feature requires the ${getPlanByTier(requiredTier).label} plan`,
        code: 'FEATURE_NOT_IN_TIER',
        details: { feature, currentTier: tier, requiredTier },
      });
    } catch (error) {
      logger.error('Tier guard error', {
        feature,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };
}
