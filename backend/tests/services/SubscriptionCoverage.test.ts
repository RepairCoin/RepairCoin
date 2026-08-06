import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

const root = path.join(__dirname, '..', '..');
const read = (...p: string[]): string => fs.readFileSync(path.join(root, ...p), 'utf8');

/**
 * Cancelling ONE of a shop's subscriptions says nothing about whether the shop is still covered.
 * A shop can hold several — that is how the duplicate billing existed at all — so a webhook that
 * demotes on the event it happens to receive locks a paying shop out of the product. Deduplicating
 * three double-billed shops did exactly that before this guard existed.
 */
describe('a cancelled subscription does not demote a shop that still has one', () => {
  const webhooks = read('src', 'domains', 'shop', 'routes', 'webhooks.ts');

  it('asks whether any OTHER live subscription remains', () => {
    expect(webhooks).toContain('stripe_subscription_id <> $2');
    expect(webhooks).toContain("status IN ('active', 'trialing', 'past_due')");
    expect(webhooks).toContain('current_period_end > NOW()');
  });

  it('decides the shop status on what remains, not on the event', () => {
    expect(webhooks).toContain('const stillCovered');
    // Whitespace-tolerant: the point is that the qualifying branch keys on stillCovered, not on
    // isActive, which is the whole difference between demoting a paying shop and not.
    expect(webhooks).toMatch(
      /if\s*\(stillCovered\)\s*\{\s*operationalStatus\s*=\s*'subscription_qualified'/
    );
  });

  it('leaves the one-row-per-shop plan record alone while cover remains', () => {
    // shop_subscriptions holds ONE row per shop: writing this cancellation into it would close the
    // plan record and point billing_reference at a dead subscription.
    expect(webhooks).toContain('if (periodEndTs && (isActive || !stillCovered))');
  });
});

/**
 * The trigger on shop_subscriptions fires after every write and has the last word on
 * operational_status. It was writing 'commitment_qualified' — a name left over from the removed
 * commitment system that no reader in the codebase tests for — so any code path touching that table
 * silently relabelled the shop into a status nothing recognised.
 */
describe('the subscription trigger writes the status the app reads', () => {
  const migration = read('migrations', '267_fix_subscription_status_trigger.sql');

  it('qualifies an active subscription as subscription_qualified', () => {
    expect(migration).toContain("THEN 'subscription_qualified'");
  });

  it('no longer writes the status nothing reads', () => {
    const body = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION'));
    expect(body).not.toContain("THEN 'commitment_qualified'");
  });

  it('cannot override an admin pause', () => {
    // A pause is a deliberate block; billing rows must not lift it.
    expect(migration).toContain("WHEN operational_status = 'paused' THEN 'paused'");
  });

  it('only relabels shops that actually have an active subscription', () => {
    const backfill = migration.slice(migration.indexOf('UPDATE shops sh'));
    expect(backfill).toContain("s.status = 'active'");
    expect(backfill).toContain('s.is_active = true');
    expect(backfill).toContain("sh.operational_status = 'commitment_qualified'");
  });
});
