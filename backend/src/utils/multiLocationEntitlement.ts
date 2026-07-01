import { isValidTier } from '../config/subscriptionPlans';
import { shopSubscriptionRepository, shopLocationRepository } from '../repositories';
import { getSharedPool } from './database-pool';
import { logger } from './logger';

const LEGACY_BUSINESS_TYPES = new Set(['standard', 'premium', 'custom']);

function isBusinessType(subscriptionType?: string | null): boolean {
  if (!subscriptionType) return false;
  if (isValidTier(subscriptionType)) return subscriptionType === 'business';
  return LEGACY_BUSINESS_TYPES.has(subscriptionType);
}

async function isShopInTrial(shopId: string): Promise<boolean> {
  try {
    const result = await getSharedPool().query(
      `SELECT status FROM stripe_subscriptions WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [shopId]
    );
    return result.rows[0]?.status === 'trialing';
  } catch {
    return false;
  }
}

/**
 * True only when a shop is genuinely on a paid Business plan. Unlike getShopTier, a free trial does
 * NOT count (trial grants business-level tier access but not paid multi-location), and a downgrade
 * drops it. This is the gate for all customer-facing multi-location behavior.
 */
export async function hasPaidMultiLocation(shopId: string): Promise<boolean> {
  try {
    if (await isShopInTrial(shopId)) return false;
    const sub = await shopSubscriptionRepository.getActiveSubscriptionByShopId(shopId);
    return isBusinessType(sub?.subscriptionType);
  } catch (error) {
    logger.warn('hasPaidMultiLocation failed, defaulting to false', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Recompute and persist shops.multi_location_active. Call after any subscription state change
 * (activation, plan change, cancel, trial end) so the stored flag stays in sync.
 */
export async function setMultiLocationActive(shopId: string): Promise<boolean> {
  const active = await hasPaidMultiLocation(shopId);
  try {
    await getSharedPool().query(
      `UPDATE shops SET multi_location_active = $2, updated_at = NOW() WHERE shop_id = $1`,
      [shopId, active]
    );
  } catch (error) {
    logger.error('Failed to persist multi_location_active', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  return active;
}

/**
 * Pick the location a booking should be tagged with. Non-entitled shops always book at the primary
 * (any submitted location is ignored); entitled shops get the requested location when it belongs to
 * the shop and is active, otherwise the primary. Returns null if the shop has no location.
 */
export async function resolveBookingLocationId(
  shopId: string,
  requestedLocationId?: string | null
): Promise<string | null> {
  const entitled = await hasPaidMultiLocation(shopId);
  if (entitled && requestedLocationId) {
    const loc = await shopLocationRepository.getById(requestedLocationId);
    if (loc && loc.shopId === shopId && loc.active) return loc.id;
  }
  const primary = await shopLocationRepository.getPrimary(shopId);
  return primary?.id ?? null;
}
