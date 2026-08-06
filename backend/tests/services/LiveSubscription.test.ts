import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

import { liveSubscriptionFirst } from '../../src/utils/sqlFragments';

const read = (rel: string): string =>
  fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

/**
 * Which `stripe_subscriptions` row speaks for a shop is decided in exactly two places — the SQL
 * fragment and its in-memory twin. Every consumer inherits whatever that row says, so a hand-written
 * `ORDER BY created_at DESC` reads a cancelled subscription as current and reports a paying shop as
 * expired. That happened in three separate code paths before this guard existed: the subscription
 * guard demoted the shop, its own dashboard showed the free plan, and the admin list showed
 * "Expired 15 days ago".
 */
describe('live subscription selection', () => {
  it('prefers a live row, then the furthest period, then recency', () => {
    const order = liveSubscriptionFirst();
    expect(order).toContain("status IN ('active', 'trialing', 'past_due')");
    expect(order).toContain('current_period_end DESC NULLS LAST');
    expect(order.indexOf('status IN')).toBeLessThan(order.indexOf('current_period_end'));
    expect(order.indexOf('current_period_end')).toBeLessThan(order.indexOf('created_at'));
  });

  it('qualifies every column when given an alias', () => {
    const order = liveSubscriptionFirst('ss');
    expect(order).toContain('ss.status');
    expect(order).toContain('ss.current_period_end');
    expect(order).toContain('ss.created_at');
  });

  it.each([
    'src/domains/admin/routes/subscription.ts',
    'src/domains/shop/routes/subscription.ts',
    'src/services/SubscriptionService.ts',
    'src/utils/shopTier.ts',
    'src/utils/multiLocationEntitlement.ts',
  ])('%s orders subscriptions through the shared fragment', (rel) => {
    expect(read(rel)).toContain('liveSubscriptionFirst');
  });

  // Scoped to queries over stripe_subscriptions: ordering stripe_payments history by recency is
  // correct and must keep working. `stripe_subscription_id` in a WHERE clause is not a match.
  const RECENCY_ORDERED_SUBSCRIPTION =
    /stripe_subscriptions\b[\s\S]{0,300}?ORDER BY\s+(shop_id,\s*)?created_at\s+DESC/i;

  it.each([
    'src/domains/admin/routes/subscription.ts',
    'src/domains/shop/routes/subscription.ts',
    'src/services/SubscriptionService.ts',
    'src/utils/shopTier.ts',
    'src/utils/multiLocationEntitlement.ts',
  ])('%s does not pick a subscription by recency alone', (rel) => {
    expect(read(rel)).not.toMatch(RECENCY_ORDERED_SUBSCRIPTION);
  });

  it('keeps the middleware twin in step with the fragment', () => {
    // Same three-step rule, expressed for rows already in memory. If one gains a status the other
    // lacks, a shop is live to one code path and expired to the other.
    const twin = read('src/middleware/subscriptionGuard.ts');
    expect(twin).toContain("['active', 'trialing', 'past_due']");
    expect(twin).toContain('pickLiveSubscription');
  });
});
