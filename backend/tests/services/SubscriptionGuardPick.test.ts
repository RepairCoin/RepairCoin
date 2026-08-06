import { describe, it, expect } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

import { pickLiveSubscription } from '../../src/middleware/subscriptionGuard';

/**
 * The four rows Ancient Realms actually had on 2026-08-06. The cancelled one (sub_...tP2m5cZv) was
 * created 90 seconds AFTER the live one, so "newest by created_at" picked a subscription whose
 * period ended on 21 July — and the guard demoted a shop paid up to 21 August to `not_qualified`,
 * which is what put the free-plan modal in front of a Business customer.
 */
const ANCIENT_REALMS = [
  {
    stripe_subscription_id: 'sub_1TZmLyL8hwPnzzXktP2m5cZv',
    status: 'canceled',
    current_period_end: '2026-07-21T22:14:36.000Z',
    created_at: '2026-05-21T22:14:41.384Z',
  },
  {
    stripe_subscription_id: 'sub_1TZmKUL8hwPnzzXkULkiDirp',
    status: 'active',
    current_period_end: '2026-08-21T22:13:04.000Z',
    created_at: '2026-05-21T22:13:10.631Z',
  },
  {
    stripe_subscription_id: 'sub_1TZiVSL8hwPnzzXkKjrnP1vq',
    status: 'active',
    current_period_end: '2026-08-21T18:08:08.000Z',
    created_at: '2026-05-21T18:08:13.931Z',
  },
  {
    stripe_subscription_id: 'sub_1TZ5IOL8hwPnzzXkXXpDz9gB',
    status: 'active',
    current_period_end: '2026-08-20T00:16:02.000Z',
    created_at: '2026-05-20T00:16:07.670Z',
  },
];

describe('pickLiveSubscription', () => {
  it('does not let a cancelled row speak for a shop that is paid up', () => {
    const picked = pickLiveSubscription(ANCIENT_REALMS);

    expect(picked?.stripe_subscription_id).toBe('sub_1TZmKUL8hwPnzzXkULkiDirp');
    // The same id the shop's own subscription record points at via billing_reference.
    expect(picked?.status).toBe('active');
    expect(new Date(picked!.current_period_end).getTime()).toBeGreaterThan(
      new Date('2026-08-06').getTime()
    );
  });

  it('prefers a live row over a cancelled one regardless of which came later', () => {
    const rows = [
      { status: 'canceled', current_period_end: '2026-12-01T00:00:00.000Z', created_at: '2026-08-01' },
      { status: 'active', current_period_end: '2026-09-01T00:00:00.000Z', created_at: '2026-01-01' },
    ];
    // Even with a further period end, a cancelled subscription is not cover.
    expect(pickLiveSubscription(rows)?.status).toBe('active');
  });

  it('treats trialing and past_due as live — neither means the shop lost access', () => {
    expect(
      pickLiveSubscription([
        { status: 'canceled', current_period_end: '2026-09-01', created_at: '2026-08-01' },
        { status: 'trialing', current_period_end: '2026-08-20', created_at: '2026-08-01' },
      ])?.status
    ).toBe('trialing');

    expect(
      pickLiveSubscription([
        { status: 'canceled', current_period_end: '2026-09-01', created_at: '2026-08-01' },
        { status: 'past_due', current_period_end: '2026-08-20', created_at: '2026-08-01' },
      ])?.status
    ).toBe('past_due');
  });

  it('takes the furthest-reaching period among live rows', () => {
    const picked = pickLiveSubscription([
      { status: 'active', current_period_end: '2026-08-20T00:00:00.000Z', created_at: '2026-08-05' },
      { status: 'active', current_period_end: '2026-08-21T00:00:00.000Z', created_at: '2026-01-01' },
    ]);
    expect(picked?.current_period_end).toBe('2026-08-21T00:00:00.000Z');
  });

  it('still reports the latest expiry when every row is dead, so expiry is caught', () => {
    const picked = pickLiveSubscription([
      { status: 'canceled', current_period_end: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01' },
      { status: 'canceled', current_period_end: '2026-07-21T00:00:00.000Z', created_at: '2025-12-01' },
    ]);
    expect(picked?.current_period_end).toBe('2026-07-21T00:00:00.000Z');
  });

  it('handles a shop with no rows and rows missing a period', () => {
    expect(pickLiveSubscription([])).toBeNull();
    expect(
      pickLiveSubscription([
        { status: 'active', current_period_end: null, created_at: '2026-01-01' },
        { status: 'active', current_period_end: '2026-09-01', created_at: '2025-01-01' },
      ])?.current_period_end
    ).toBe('2026-09-01');
  });
});
