import { SubscriptionTier, isValidTier, AI_TIER_ALLOWANCE } from '../config/subscriptionPlans';
import { shopSubscriptionRepository } from '../repositories';
import { getSharedPool } from './database-pool';
import { logger } from './logger';

// Legacy pre-3-tier plans that paid the top historical price; grandfather to business.
const LEGACY_BUSINESS_TYPES = new Set(['standard', 'premium', 'custom']);

// Unknown/missing types fail closed to the lowest tier; legacy paid plans stay business.
function normalizeTier(subscriptionType?: string | null): SubscriptionTier {
  if (subscriptionType && isValidTier(subscriptionType)) return subscriptionType;
  if (subscriptionType && LEGACY_BUSINESS_TYPES.has(subscriptionType)) return 'business';
  return 'starter';
}

async function isShopInTrial(shopId: string): Promise<boolean> {
  try {
    const pool = getSharedPool();
    const result = await pool.query(
      `SELECT status FROM stripe_subscriptions WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [shopId]
    );
    return result.rows[0]?.status === 'trialing';
  } catch {
    return false;
  }
}

// During the free trial a shop has full access to every feature, so it resolves
// to the top tier regardless of the plan it is trialing.
export async function getShopTier(shopId: string): Promise<SubscriptionTier> {
  try {
    if (await isShopInTrial(shopId)) return 'business';
    const sub = await shopSubscriptionRepository.getActiveSubscriptionByShopId(shopId);
    return normalizeTier(sub?.subscriptionType);
  } catch (error) {
    logger.warn('getShopTier failed, defaulting to starter', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 'starter';
  }
}

// The shop's included monthly AI budget ($10/$30/$75) — a PURE FUNCTION of its tier. This is the
// single source of truth for the cap AND for the read-only usage monitor; it is never hand-set.
export async function getShopAiBudget(shopId: string): Promise<number> {
  return AI_TIER_ALLOWANCE[await getShopTier(shopId)];
}
