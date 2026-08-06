// `order_ready` — "your order is ready to collect".
//
// The design decision this pins is that it is NOT a status.
//
// The scope line asked for "repair ready for pickup", but repairs are ~21% of services on the platform
// (beauty 37, repairs 34, fitness 20, automotive 10, pet care, tech…). For a barber or a gym class
// there is nothing to collect and "ready" and "completed" are the same instant — the gap between them
// only exists for drop-off businesses. Adding a lifecycle stage would put a step in every shop's
// booking flow to serve a minority, and would force an audit of every query filtering on status,
// including the revenue/booked split where a new value landing in the wrong bucket is exactly the bug
// that took a week to notice.
//
// So: a button the shop presses, one additive timestamp, and the order's status untouched. If someone
// later "tidies this up" into a status value, these tests are the argument against it.

import * as fs from 'fs';
import * as path from 'path';

const src = path.join(__dirname, '..', '..');
const read = (...p: string[]) => fs.readFileSync(path.join(src, ...p), 'utf8');

const controller = read('src', 'domains', 'ServiceDomain', 'controllers', 'OrderController.ts');
const routes = read('src', 'domains', 'ServiceDomain', 'routes.ts');
const autoMsg = read('src', 'domains', 'messaging', 'controllers', 'AutoMessageController.ts');
const domain = read('src', 'domains', 'messaging', 'index.ts');
const repo = read('src', 'repositories', 'OrderRepository.ts');
const migration = read('migrations', '269_add_order_ready_notified.sql');

describe('it is an event, not a status', () => {
  it('adds no value to the service_orders status constraint', () => {
    // The whole point. A CHECK-constraint change here would mean auditing every status filter.
    expect(migration).not.toMatch(/status.*CHECK|CHECK.*status/i);
    expect(migration).toContain('ready_notified_at');
  });

  it('is additive — a nullable column, not a backfill', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS ready_notified_at');
    expect(migration).not.toMatch(/UPDATE service_orders/i);
  });

  it('the endpoint never writes status', () => {
    const fn = controller.slice(controller.indexOf('notifyReady = async'), controller.indexOf('markNoShow = async'));
    expect(fn).not.toMatch(/status\s*=\s*['"]/);
    expect(fn).toContain('markReadyNotified');
  });
});

describe('the shop must own the order, and it must be collectable', () => {
  const fn = () => controller.slice(controller.indexOf('notifyReady = async'), controller.indexOf('markNoShow = async'));

  it('401s without a shop, 404s for a missing order, 403s for another shop', () => {
    const body = fn();
    expect(body).toContain('Shop authentication required');
    expect(body).toContain('Order not found');
    expect(body).toContain('Unauthorized to update this order');
  });

  it('refuses an order nobody can collect', () => {
    // Telling a customer to come and fetch something that was cancelled or refunded is worse than
    // silence — they make a trip for nothing.
    const body = fn();
    expect(body).toContain('COLLECTABLE');
    for (const s of ['paid', 'approved', 'scheduled', 'completed']) expect(body).toContain(`'${s}'`);
    expect(body).not.toMatch(/COLLECTABLE = \[[^\]]*'cancelled'/);
    expect(body).not.toMatch(/COLLECTABLE = \[[^\]]*'refunded'/);
    expect(body).not.toMatch(/COLLECTABLE = \[[^\]]*'no_show'/);
  });

  it('does not require Stripe to be connected', () => {
    // Sending a message takes no payment, and a shop mid-onboarding still has customers waiting.
    // Bounded to THIS route's own registration. A fixed-length slice runs into the next route, which
    // does require Stripe — and the assertion then fails for a reason that has nothing to do with it.
    const start = routes.indexOf("'/orders/:id/notify-ready'");
    const route = routes.slice(start, routes.indexOf(');', start));
    expect(route).not.toContain('requireStripeConnected');
    expect(route).toContain("requireShopPermission('bookings:manage')");
  });
});

describe('a second press cannot message the customer twice', () => {
  it('guards in the WHERE clause, not by reading first', () => {
    // A read-then-write loses the race between two clicks landing together, and the customer is told
    // twice that the same thing is ready.
    const fn = repo.slice(repo.indexOf('async markReadyNotified'));
    expect(fn.slice(0, 700)).toContain('ready_notified_at IS NULL');
    expect(fn.slice(0, 700)).toContain('RETURNING ready_notified_at');
  });

  it('the endpoint reports which happened rather than lying', () => {
    const fn = controller.slice(controller.indexOf('notifyReady = async'), controller.indexOf('markNoShow = async'));
    expect(fn).toContain('alreadyNotified: true');
    expect(fn).toContain('alreadyNotified: false');
  });

  it('publishes ONLY on the first press', () => {
    // The publish sits after the early return, so a repeat cannot re-fire the workflow.
    const fn = controller.slice(controller.indexOf('notifyReady = async'), controller.indexOf('markNoShow = async'));
    expect(fn.indexOf('alreadyNotified: true')).toBeLessThan(fn.indexOf("'service.order_ready'"));
  });

  it('a bus failure cannot fail the shop action', () => {
    const fn = controller.slice(controller.indexOf('notifyReady = async'), controller.indexOf('markNoShow = async'));
    expect(fn).toContain('Failed to publish service.order_ready');
  });
});

describe('the trigger is wired end to end', () => {
  it('is accepted by the API', () => {
    const block = autoMsg.slice(
      autoMsg.indexOf('const VALID_EVENT_TYPES'),
      autoMsg.indexOf('];', autoMsg.indexOf('const VALID_EVENT_TYPES'))
    );
    expect(block).toContain("'order_ready'");
  });

  it('is CUSTOMER-scoped, so it pairs with customer-facing actions', () => {
    // Unlike low_stock or subscription_lapsed, there is exactly one person waiting on this order.
    const shopScoped = autoMsg.slice(autoMsg.indexOf('const SHOP_SCOPED_EVENTS')).slice(0, 200);
    expect(shopScoped).not.toContain('order_ready');
  });

  it('subscribes to the event the endpoint publishes', () => {
    expect(domain).toContain("eventBus.subscribe('service.order_ready'");
    const block = domain.slice(domain.indexOf("eventBus.subscribe('service.order_ready'"));
    expect(block.slice(0, 900)).toContain("handleEventTrigger('order_ready'");
  });
});
