// W3 — operations triggers.
//
// The failure mode this guards against is specific and silent: a trigger offered in the UI and accepted
// by the API that NOTHING ever publishes. The shop builds a workflow, activates it, and waits forever
// for an automation that can't fire. No error, no log, just nothing.
//
// So every accepted event type must be wired to a real bus subscription, and vice versa.

import * as fs from 'fs';
import * as path from 'path';

const controller = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'domains', 'messaging', 'controllers', 'AutoMessageController.ts'),
  'utf8'
);
const domain = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'domains', 'messaging', 'index.ts'),
  'utf8'
);

/** The event types the API will accept on a rule. */
function acceptedEventTypes(): string[] {
  const start = controller.indexOf('const VALID_EVENT_TYPES');
  const block = controller.slice(start, controller.indexOf('];', start));
  return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

/**
 * The event types MessagingDomain actually hands to the scheduler — via EITHER path.
 * handleEventTrigger is the customer-scoped one; handleShopEvent is the shop-scoped one (low_stock).
 */
function firedEventTypes(): string[] {
  return [...domain.matchAll(/handle(?:EventTrigger|ShopEvent)\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
}

describe('W3 — every offered trigger is actually wired', () => {
  const OPERATIONS = ['no_show', 'review_received', 'low_rating', 'payment_failed'];

  it('accepts the operations triggers', () => {
    for (const t of OPERATIONS) expect(acceptedEventTypes()).toContain(t);
  });

  // The important direction: nothing is offered that can never fire.
  it('every accepted event type is fired by a real subscription', () => {
    const fired = firedEventTypes();
    // inactive_30_days and low_bookings come from scheduled sweeps rather than the bus.
    const sweepDriven = ['inactive_30_days', 'low_bookings'];
    const orphaned = acceptedEventTypes().filter((t) => !fired.includes(t) && !sweepDriven.includes(t));
    expect({ orphaned }).toEqual({ orphaned: [] });
  });

  it('every fired event type is accepted by the API', () => {
    const accepted = acceptedEventTypes();
    const unknown = firedEventTypes().filter((t) => !accepted.includes(t));
    expect({ unknown }).toEqual({ unknown: [] });
  });

  it('subscribes to the underlying platform events', () => {
    expect(domain).toContain("eventBus.subscribe('service.order_no_show'");
    expect(domain).toContain("eventBus.subscribe('review:created'");
    expect(domain).toContain("eventBus.subscribe('service.payment_failed'");
    expect(domain).toContain("eventBus.subscribe('inventory:low_stock_alert'");
  });

  // 1–2 of 5 is unambiguously unhappy; 3 is mixed, and running a "let us make it right" flow at
  // someone who left a fair review reads as tone-deaf.
  it('treats 1–2 stars as a low rating, not 3', () => {
    expect(domain).toContain('const LOW_RATING_THRESHOLD = 2');
  });
});
