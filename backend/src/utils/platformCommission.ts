import { SubscriptionTier } from '../config/subscriptionPlans';
import { getShopTier } from './shopTier';
import { logger } from './logger';

/**
 * Per-booking platform commission, in basis points, by the shop's subscription tier.
 * Taken as a Stripe `application_fee_amount` on the booking charge (destination charge to the
 * shop's connected account), so it lands in the platform's Stripe balance automatically.
 *
 *   Free / Starter / Growth : 1%   (100 bps)
 *   Business                : 0.5% (50 bps)
 *
 * Free is set to 100 bps deliberately: a shop with no subscription already resolved to
 * 'starter' and paid 1%, so keeping it there means introducing the free tier changes no
 * shop's commission. Charging free shops a HIGHER rate is the obvious way to monetise the
 * tier, but that is a pricing decision, not a plumbing one — left for a follow-up.
 */
const COMMISSION_BPS: Record<SubscriptionTier, number> = {
  free: 100,
  starter: 100,
  growth: 100,
  business: 50,
};

export function commissionBpsForTier(tier: SubscriptionTier): number {
  return COMMISSION_BPS[tier];
}

/**
 * Platform commission (application fee) in cents for a booking charge, from the shop's CURRENT
 * tier. Fail-open: returns 0 if the tier can't be resolved, so a hiccup here never blocks a
 * customer's payment (worst case: that one booking takes no commission).
 */
export async function computeBookingCommissionCents(
  shopId: string,
  amountCents: number
): Promise<number> {
  if (!amountCents || amountCents <= 0) return 0;
  try {
    const tier = await getShopTier(shopId);
    const fee = Math.round((amountCents * commissionBpsForTier(tier)) / 10000);
    // Never let the fee meet/exceed the charge (Stripe rejects it, and it'd be nonsensical).
    return Math.min(fee, amountCents - 1);
  } catch (error) {
    logger.warn('computeBookingCommissionCents failed; charging no commission', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}
