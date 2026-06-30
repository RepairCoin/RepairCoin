import { Request, Response, NextFunction } from 'express';
import { getShopTier } from '../utils/shopTier';
import { tierAllowsFeature, getRequiredTier } from '../config/featureTiers';
import { getPlanByTier } from '../config/subscriptionPlans';
import { logger } from '../utils/logger';

export function requireTier(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId =
        req.params.shopId || req.body?.shopId || (req as any).shopId || req.user?.shopId;

      if (!shopId) {
        return res.status(400).json({ success: false, error: 'Shop ID required', code: 'MISSING_SHOP_ID' });
      }

      const tier = await getShopTier(shopId);
      if (tierAllowsFeature(tier, feature)) return next();

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
