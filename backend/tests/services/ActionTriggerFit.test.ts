// Which actions make sense for which triggers — stated once, instead of each bad pairing being found
// by a shop.
//
// Only one rule existed before: a shop-scoped trigger needs a shop-facing action. Everything else was
// unguarded, which is how "Send a campaign" on Booking Completed slipped through — it fires once per
// event and sends to the WHOLE audience, so five completed bookings on a busy day is five blasts to
// the entire list.

import * as fs from 'fs';
import * as path from 'path';
import { ACTION_NEEDS } from '../../src/services/autoMessageActions/registry';

const controller = fs
  .readFileSync(
    path.join(__dirname, '..', '..', 'src', 'domains', 'messaging', 'controllers', 'AutoMessageController.ts'),
    'utf8'
  )
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** Mirrors triggerProvides + actionFitsTrigger. */
const SHOP_SCOPED = new Set(['low_stock', 'new_ad_lead']);
const SWEEPS = new Set(['inactive_30_days', 'low_bookings']);
const provides = (trigger: string, event?: string) =>
  trigger === 'schedule' ? 'audience' : SHOP_SCOPED.has(event || '') ? 'nothing' : SWEEPS.has(event || '') ? 'audience' : 'customer';
const fits = (action: string, trigger: string, event?: string) => {
  const needs = ACTION_NEEDS[action] ?? 'customer';
  if (needs === 'nobody') return true;
  const p = provides(trigger, event);
  if (p === 'nothing') return false;
  return needs === 'customer' ? true : p === 'audience';
};

describe('what each action needs', () => {
  it('classifies every action that exists', () => {
    for (const a of ['send_message', 'issue_reward', 'ai_step', 'run_campaign', 'notify_staff', 'draft_reorder']) {
      expect(ACTION_NEEDS[a]).toBeDefined();
    }
  });

  // The one the guard was added for.
  it('marks run_campaign as needing a whole audience', () => {
    expect(ACTION_NEEDS.run_campaign).toBe('audience');
  });
});

describe('campaigns only on triggers that produce a group', () => {
  it('refuses a campaign on a per-customer event', () => {
    for (const e of ['booking_completed', 'no_show', 'review_received', 'payment_failed']) {
      expect(fits('run_campaign', 'event', e)).toBe(false);
    }
  });

  it('allows a campaign on a schedule and on both sweeps', () => {
    expect(fits('run_campaign', 'schedule')).toBe(true);
    expect(fits('run_campaign', 'event', 'inactive_30_days')).toBe(true);
    expect(fits('run_campaign', 'event', 'low_bookings')).toBe(true);
  });

  // A shop-scoped event has no audience either — the campaign would fall back to whatever was
  // stored, which is how a recurring send quietly reaches everybody.
  it('refuses a campaign on a shop-scoped event', () => {
    expect(fits('run_campaign', 'event', 'low_stock')).toBe(false);
  });
});

describe('the older rule still holds, as a consequence rather than a special case', () => {
  it('refuses customer-facing actions on shop-scoped events', () => {
    for (const a of ['send_message', 'issue_reward', 'ai_step']) {
      expect(fits(a, 'event', 'low_stock')).toBe(false);
      expect(fits(a, 'event', 'new_ad_lead')).toBe(false);
    }
  });

  it('allows shop-facing actions anywhere', () => {
    for (const a of ['notify_staff', 'draft_reorder']) {
      expect(fits(a, 'event', 'low_stock')).toBe(true);
      expect(fits(a, 'schedule')).toBe(true);
      expect(fits(a, 'event', 'booking_completed')).toBe(true);
    }
  });

  // An audience trigger feeds a per-customer action fine — the engine loops over the group.
  it('allows per-customer actions on audience triggers', () => {
    expect(fits('send_message', 'schedule')).toBe(true);
    expect(fits('ai_step', 'event', 'inactive_30_days')).toBe(true);
  });
});

describe('both write paths enforce it', () => {
  it('checks create and update, on effective values', () => {
    expect((controller.match(/actionFitsTrigger\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(controller).toMatch(/actionFitsTrigger\(effectiveActionType/);
  });
});
