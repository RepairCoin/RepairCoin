/**
 * Subscription Guard Middleware
 *
 * Blocks operations for shops with paused, expired, or invalid subscriptions.
 * RCG-qualified shops (10K+ tokens) bypass subscription requirements.
 */

import { Request, Response, NextFunction } from 'express';
import { shopRepository } from '../repositories';
import { logger } from '../utils/logger';

export interface SubscriptionGuardOptions {
  allowRcgQualified?: boolean;  // Allow RCG-qualified shops (default: true)
  allowCancelledInPeriod?: boolean;  // Allow cancelled but still in billing period (default: true)
}

const DEFAULT_OPTIONS: SubscriptionGuardOptions = {
  allowRcgQualified: true,
  allowCancelledInPeriod: true
};

/**
 * Get a user-friendly message for blocked status
 */
function getBlockedMessage(status: string): string {
  switch (status) {
    case 'paused':
      return 'Your subscription is paused by the administrator. Operations are temporarily disabled until the subscription is resumed.';
    case 'not_qualified':
      return 'An active RepairCoin subscription or RCG qualification (10K+ tokens) is required to perform this operation.';
    case 'pending':
      return 'Please complete your subscription setup to access this feature.';
    case 'expired':
      return 'Your subscription has expired. Please renew your subscription to continue operations.';
    default:
      return 'Active subscription required to perform this operation.';
  }
}

/**
 * Middleware to check if shop has an active subscription
 * Blocks operations for paused, expired, or cancelled subscriptions
 */
export const requireActiveSubscription = (options: SubscriptionGuardOptions = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract shopId from various sources (including req.user from auth middleware)
      const shopId = req.params.shopId || req.body.shopId || (req as any).shopId || req.user?.shopId;

      if (!shopId) {
        logger.warn('Subscription guard: No shop ID provided', {
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

      // Check if shop is RCG qualified (bypass subscription check)
      if (opts.allowRcgQualified) {
        const rcgBalance = shop.rcg_balance ? parseFloat(shop.rcg_balance.toString()) : 0;
        const isRcgQualified = shop.operational_status === 'rcg_qualified' || rcgBalance >= 10000;

        if (isRcgQualified) {
          logger.debug('Subscription guard: RCG qualified, allowing operation', {
            shopId,
            rcgBalance,
            operationalStatus: shop.operational_status
          });
          return next();
        }
      }

      // Check operational status for blocked states
      const blockedStatuses = ['paused', 'not_qualified', 'pending'];

      if (blockedStatuses.includes(shop.operational_status || '')) {
        logger.warn('Subscription guard: Operation blocked', {
          shopId,
          operationalStatus: shop.operational_status,
          endpoint: req.path,
          method: req.method
        });

        return res.status(403).json({
          success: false,
          error: 'Active subscription required',
          code: 'SUBSCRIPTION_INACTIVE',
          details: {
            status: shop.operational_status,
            message: getBlockedMessage(shop.operational_status || 'not_qualified')
          }
        });
      }

      // Check subscription_qualified status or active subscription
      if (shop.operational_status === 'subscription_qualified' || shop.subscriptionActive) {
        return next();
      }

      // Default: block if we got here without passing any check
      logger.warn('Subscription guard: No valid subscription found', {
        shopId,
        operationalStatus: shop.operational_status,
        subscriptionActive: shop.subscriptionActive
      });

      return res.status(403).json({
        success: false,
        error: 'Active subscription required',
        code: 'SUBSCRIPTION_INACTIVE',
        details: {
          status: shop.operational_status || 'unknown',
          message: getBlockedMessage(shop.operational_status || 'not_qualified')
        }
      });

    } catch (error) {
      logger.error('Subscription guard error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path
      });
      next(error);
    }
  };
};

/**
 * Convenience middleware with default options
 */
export const subscriptionGuard = requireActiveSubscription();
