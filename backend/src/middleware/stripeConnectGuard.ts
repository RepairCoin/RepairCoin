/**
 * Stripe Connect Guard Middleware
 *
 * Blocks booking-related operations for shops that have not completed Stripe Connect
 * onboarding (no connected account, or charges not yet enabled). A shop that can't
 * receive money must not be able to take or run bookings.
 *
 * This is independent of the subscription/RCG gate (subscriptionGuard.ts) — a shop can
 * be subscription-qualified yet still have no payout account. Both gates may apply to
 * the same route.
 */

import { Request, Response, NextFunction } from 'express';
import { shopRepository } from '../repositories';
import { logger } from '../utils/logger';

/**
 * Single source of truth for "this shop can accept payments / bookings". Mirrors the
 * `getOnboardingSummary` view used by the dashboard banner: a real connected account AND
 * Stripe having flipped charges on. Kept as a pure predicate so controllers (customer-side
 * booking creation) and middleware (shop-side management) share one definition.
 */
export function isShopStripeConnected(
  shop: { stripeConnectAccountId?: string | null; connectChargesEnabled?: boolean } | null | undefined
): boolean {
  return !!shop && !!shop.stripeConnectAccountId && shop.connectChargesEnabled === true;
}

export const STRIPE_NOT_CONNECTED_MESSAGE =
  'Connect your Stripe account to enable bookings. Set up payouts to create services and accept or manage bookings.';

export interface StripeConnectGuardOptions {
  /**
   * How to find the shop being acted on. Defaults to the usual precedence
   * (params → body → req.shopId → authenticated shop), which covers both shop-side
   * routes (req.user.shopId) and shop-scoped routes like /shops/:shopId/... .
   */
  resolveShopId?: (req: Request) => string | undefined;
}

/**
 * Require the target shop to have Stripe Connect charges enabled. Returns 403
 * STRIPE_NOT_CONNECTED otherwise.
 */
export const requireStripeConnected = (options: StripeConnectGuardOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = options.resolveShopId
        ? options.resolveShopId(req)
        : req.params.shopId || req.body.shopId || (req as any).shopId || req.user?.shopId;

      if (!shopId) {
        logger.warn('Stripe connect guard: no shop ID provided', {
          path: req.path,
          method: req.method
        });
        return res.status(400).json({
          success: false,
          error: 'Shop ID required',
          code: 'MISSING_SHOP_ID'
        });
      }

      const shop = await shopRepository.getShop(shopId);

      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found',
          code: 'SHOP_NOT_FOUND'
        });
      }

      if (!isShopStripeConnected(shop)) {
        logger.warn('Stripe connect guard: shop has not connected payouts', {
          shopId,
          endpoint: req.path,
          method: req.method
        });
        return res.status(403).json({
          success: false,
          error: 'Stripe payouts not connected',
          code: 'STRIPE_NOT_CONNECTED',
          details: { message: STRIPE_NOT_CONNECTED_MESSAGE }
        });
      }

      return next();
    } catch (error) {
      logger.error('Stripe connect guard error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path
      });
      next(error);
    }
  };
};
