/**
 * `shops.operational_status` — whether a shop has paid for access, and how.
 *
 * Kept in one place because the "is this shop paying?" test was previously re-written at each call
 * site, and they drifted: `commitment_qualified` (written when a commitment plan is activated,
 * shop/routes/subscription.ts) was recognised by none of them, so a shop that had paid for a
 * commitment plan read as unpaid and was shown the free-plan upgrade prompt.
 *
 * Add a new paid status HERE, not at a call site.
 */
export type OperationalStatus =
  | 'pending'
  | 'rcg_qualified'
  | 'subscription_qualified'
  | 'commitment_qualified'
  | 'not_qualified'
  | 'paused';

/** Statuses that mean the shop has access — by subscription, commitment, or RCG holdings. */
export const QUALIFIED_STATUSES: readonly string[] = [
  'rcg_qualified',
  'subscription_qualified',
  'commitment_qualified',
];

export function isQualifiedStatus(status?: string | null): boolean {
  return !!status && QUALIFIED_STATUSES.includes(status);
}

/** Paid-plan access specifically, as opposed to holding RCG. */
export function hasPaidPlanStatus(status?: string | null): boolean {
  return status === 'subscription_qualified' || status === 'commitment_qualified';
}
