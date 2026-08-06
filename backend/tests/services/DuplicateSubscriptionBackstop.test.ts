import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

import { chooseSubscriptionToKeep } from '../../src/utils/subscriptionSurvivor';

const root = path.join(__dirname, '..', '..');
const read = (...p: string[]): string => fs.readFileSync(path.join(root, ...p), 'utf8');

const sub = (id: string, amountCents: number, periodEnd: number, created: number) => ({
  id,
  amountCents,
  periodEnd,
  created,
});

describe('choosing which duplicate a shop keeps', () => {
  it('keeps the more valuable plan rather than the newer one', () => {
    // Ancient Realms held a $599 Business subscription and two $500s. Sorting by date would have
    // cancelled the plan it pays most for and silently downgraded the shop.
    const keep = chooseSubscriptionToKeep([
      sub('sub_cheap_new', 50000, 200, 300),
      sub('sub_business', 59900, 200, 100),
    ]);
    expect(keep?.id).toBe('sub_business');
  });

  it('prefers the furthest-reaching period among equal plans', () => {
    const keep = chooseSubscriptionToKeep([
      sub('sub_short', 50000, 100, 100),
      sub('sub_long', 50000, 500, 200),
    ]);
    expect(keep?.id).toBe('sub_long');
  });

  it('gives the same answer whichever order the rows arrive in', () => {
    // Two webhooks can process at once. If they disagreed about the survivor they would cancel each
    // other's keeper and leave the shop with no subscription at all.
    const a = sub('sub_a', 50000, 200, 100);
    const b = sub('sub_b', 50000, 200, 100);
    expect(chooseSubscriptionToKeep([a, b])?.id).toBe(chooseSubscriptionToKeep([b, a])?.id);
  });

  it('breaks a total tie deterministically rather than by luck', () => {
    const keep = chooseSubscriptionToKeep([
      sub('sub_zzz', 50000, 200, 100),
      sub('sub_aaa', 50000, 200, 100),
    ]);
    expect(keep?.id).toBe('sub_aaa');
  });

  it('has no answer when there is nothing to choose from', () => {
    expect(chooseSubscriptionToKeep([])).toBeNull();
  });
});

describe('the webhook backstop', () => {
  const webhooks = read('src', 'domains', 'shop', 'routes', 'webhooks.ts');

  it('runs when a subscription is created, where Stripe is authoritative', () => {
    expect(webhooks).toContain('cancelDuplicateSubscriptions');
    // Asked of Stripe, not of our mirror: at this moment the mirror may hold neither subscription.
    expect(webhooks).toMatch(/subscriptions\.list\(\{\s*customer: customerId/);
  });

  it('uses the shared survivor rule instead of its own', () => {
    expect(webhooks).toContain('chooseSubscriptionToKeep');
  });

  it('never counts the Agency Program as a duplicate plan', () => {
    const fn = webhooks.slice(webhooks.indexOf('async function cancelDuplicateSubscriptions'));
    expect(fn).toContain("s.metadata?.type !== 'agency_activation'");
  });

  it('does nothing when the shop has only one live subscription', () => {
    const fn = webhooks.slice(webhooks.indexOf('async function cancelDuplicateSubscriptions'));
    expect(fn).toContain('if (live.length <= 1) return;');
  });

  it('can be reduced to a log by operators', () => {
    expect(webhooks).toContain("process.env.DUPLICATE_SUBSCRIPTION_AUTOCANCEL === 'false'");
  });

  it('cannot take down the webhook when Stripe misbehaves', () => {
    // A failed duplicate check must not stop the subscription being recorded.
    expect(webhooks).toMatch(/cancelDuplicateSubscriptions\(subscription\)\.catch/);
  });
});

describe('the dedupe script and the webhook agree', () => {
  it('both import the one survivor rule', () => {
    expect(read('scripts', 'dedupe-shop-subscriptions.ts')).toContain('chooseSubscriptionToKeep');
    expect(read('src', 'domains', 'shop', 'routes', 'webhooks.ts')).toContain(
      'chooseSubscriptionToKeep'
    );
  });

  it('neither keeps a private copy of the rule', () => {
    expect(read('scripts', 'dedupe-shop-subscriptions.ts')).not.toContain('function pickSurvivor');
  });
});
