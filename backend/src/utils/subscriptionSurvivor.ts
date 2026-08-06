/**
 * Which of a shop's duplicate subscriptions to keep.
 *
 * Two places need this answer and they must never disagree: the webhook that catches a duplicate as
 * it is created, and the script that clears duplicates already billing. If they picked differently
 * they could cancel each other's survivor and leave a shop with nothing.
 *
 * Most valuable plan first, because a shop paying for two tiers should keep the one it chose to pay
 * MORE for — sorting by date alone would silently downgrade a shop from Business to a cheaper plan.
 * Then the furthest-reaching billing period, which is the cover actually paid for. Then the oldest,
 * so the answer does not change depending on which subscription arrives first: two webhooks racing
 * each other must compute the same survivor or they will both cancel and both be wrong.
 */
export interface SubscriptionChoice {
  id: string;
  amountCents: number;
  periodEnd: number;
  created: number;
}

export function chooseSubscriptionToKeep<T extends SubscriptionChoice>(subs: T[]): T | null {
  if (subs.length === 0) return null;
  return [...subs].sort(
    (a, b) =>
      b.amountCents - a.amountCents ||
      b.periodEnd - a.periodEnd ||
      a.created - b.created ||
      a.id.localeCompare(b.id)
  )[0];
}
