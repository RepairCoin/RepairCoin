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

// A second failure mode, worse than the one above because the tests above cannot see it.
//
// `booking_created` rides on `service.order_created`, which WAS published — from the manual-booking and
// ad-lead paths, but never from the path customers actually book through. Every check above passes in
// that state: the event type is accepted, a subscription exists, the subscription fires. The trigger
// simply misses most bookings, and looks healthy while doing it.
//
// So the thing to pin is not "is it published" but "is it published from EVERY place an order is born".
describe('booking_created — published from every path that creates an order', () => {
  const src = path.join(__dirname, '..', '..', 'src');
  const read = (...p: string[]) => fs.readFileSync(path.join(src, ...p), 'utf8');

  // The three creation paths, verified against `grep "INSERT INTO service_orders"` plus the single
  // caller of OrderRepository.createOrder. If a fourth is ever added it must be added here too — which
  // is the point of naming them rather than globbing.
  const CREATION_PATHS: ReadonlyArray<[string, string[]]> = [
    ['customer self-service (Stripe)', ['domains', 'ServiceDomain', 'services', 'PaymentService.ts']],
    ['shop enters it by hand', ['domains', 'ServiceDomain', 'controllers', 'ManualBookingController.ts']],
    ['booked from an ad lead', ['domains', 'AdsDomain', 'services', 'LeadBookingService.ts']],
  ];

  it.each(CREATION_PATHS)('publishes service.order_created — %s', (_label, file) => {
    expect(read(...file)).toContain("'service.order_created'");
  });

  /** Every .ts under src, so "no fourth path" is checked rather than assumed. */
  const allSourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return allSourceFiles(full);
      return e.isFile() && e.name.endsWith('.ts') ? [full] : [];
    });

  it('no fourth creation path is hiding', () => {
    // CREATION_PATHS is a hand-maintained list, which makes it a lie waiting to happen. This finds every
    // file that inserts an order row or calls the repository that does, and fails when one appears that
    // is not accounted for above — so the next person to add a booking flow is told about this event
    // instead of discovering the gap the way we did.
    const found = allSourceFiles(src)
      .filter((f) => {
        const body = fs.readFileSync(f, 'utf8');
        return /INSERT INTO service_orders/i.test(body) || /\.createOrder\(/.test(body);
      })
      .map((f) => path.relative(src, f).replace(/\\/g, '/'));

    const expected = [
      'domains/AdsDomain/services/LeadBookingService.ts',
      'domains/ServiceDomain/controllers/ManualBookingController.ts',
      'domains/ServiceDomain/services/PaymentService.ts',
      'repositories/OrderRepository.ts', // the shared INSERT; publishes nothing, by design
    ];
    expect(found.sort()).toEqual(expected.sort());
  });

  it('the repository itself does NOT publish — the callers do', () => {
    // Publishing from the repo would fire for fixtures, backfills and migrations too. Keeping it at the
    // call sites is what lets the manual path say 'pending' and this one say 'paid'.
    expect(read('repositories', 'OrderRepository.ts')).not.toContain("'service.order_created'");
  });

  it('carries the order status, which decides the ads Kanban stage', () => {
    // adsEventListeners reads `status` to pick 'booked' vs 'paid'. Dropping it silently downgrades
    // every self-service booking to 'booked' even though it is paid.
    const payment = read('domains', 'ServiceDomain', 'services', 'PaymentService.ts');
    const block = payment.slice(payment.indexOf("'service.order_created'"));
    expect(block.slice(0, 800)).toContain('status: order.status');
  });

  it('a bus failure cannot fail the Stripe webhook', () => {
    // This runs inside the webhook. An unguarded throw means Stripe retries a payment we already took.
    const payment = read('domains', 'ServiceDomain', 'services', 'PaymentService.ts');
    const block = payment.slice(payment.indexOf("'service.order_created'"));
    expect(block.slice(0, 900)).toContain('Failed to publish service.order_created');
  });
});
