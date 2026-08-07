// `subscription_lapsed` — the shop's OWN subscription payment failing.
//
// Two things make this trigger unusual, and both are pinned here because both are easy to "fix" into
// uselessness later.
//
// 1. It fires on the payment FAILING, not on cancellation. After a cancellation the shop is no longer
//    entitled to automations at all — isShopEntitled skips it — so a workflow could not deliver the
//    message even if it existed. Scoping to past_due is what makes it deliverable, and it is also the
//    more useful moment: a warning with time left to act on.
// 2. It dedups by INVOICE. Stripe retries an unpaid invoice over several days and re-delivers webhooks
//    on any non-2xx, so without that the team is paged again and again about one bill.

const mockRun = jest.fn(async () => ({ ok: true }));
jest.mock('../../src/services/autoMessageActions/registry', () => {
  const actual = jest.requireActual('../../src/services/autoMessageActions/registry');
  return { ...actual, getAutoMessageActionRegistry: () => ({ run: mockRun }) };
});
jest.mock('../../src/utils/database-pool', () => ({
  getSharedPool: () => ({ query: jest.fn(async () => ({ rows: [] })) }),
}));

import * as fs from 'fs';
import * as path from 'path';

const src = path.join(__dirname, '..', '..', 'src');
const read = (...p: string[]) => fs.readFileSync(path.join(src, ...p), 'utf8');

const controller = read('domains', 'messaging', 'controllers', 'AutoMessageController.ts');
const domain = read('domains', 'messaging', 'index.ts');
const scheduler = read('services', 'AutoMessageSchedulerService.ts');
const repo = read('repositories', 'AutoMessageRepository.ts');

describe('subscription_lapsed is offered and shop-scoped', () => {
  it('is accepted by the API', () => {
    const block = controller.slice(
      controller.indexOf('const VALID_EVENT_TYPES'),
      controller.indexOf('];', controller.indexOf('const VALID_EVENT_TYPES'))
    );
    expect(block).toContain("'subscription_lapsed'");
  });

  it('is declared shop-scoped, so customer-facing actions are refused on it', () => {
    // It happens to the shop's billing. "Send a message" would have nobody to send to, and the rule
    // would sit there looking active while doing nothing.
    const line = controller.slice(controller.indexOf('const SHOP_SCOPED_EVENTS'));
    expect(line.slice(0, 200)).toContain('subscription_lapsed');
  });

  it('is not confused with payment_failed, which is a CUSTOMER event', () => {
    // Both exist, they mean opposite things, and the names are one word apart. If these ever collapse
    // into one, a shop's billing alert starts going to customers.
    const block = controller.slice(
      controller.indexOf('const VALID_EVENT_TYPES'),
      controller.indexOf('];', controller.indexOf('const VALID_EVENT_TYPES'))
    );
    expect(block).toContain("'payment_failed'");
    const shopScoped = controller.slice(controller.indexOf('const SHOP_SCOPED_EVENTS')).slice(0, 200);
    expect(shopScoped).not.toContain("'payment_failed'");
  });
});

describe('it rides on an event that already exists', () => {
  it('subscribes to payment.webhook.failed', () => {
    // The Stripe webhook has published this all along with the shopId already resolved; nothing
    // consumed it for automations. No new publish was needed, so there is no second source of truth
    // about whether a payment failed.
    expect(domain).toContain("eventBus.subscribe('payment.webhook.failed'");
  });

  it('routes through the shop-scoped path, not the customer one', () => {
    const block = domain.slice(domain.indexOf("eventBus.subscribe('payment.webhook.failed'"));
    expect(block.slice(0, 1500)).toContain("handleShopEvent('subscription_lapsed'");
  });

  it('passes the INVOICE as the dedup reference, not the attempt', () => {
    // Keyed on the bill, so retry #2 for the same invoice is recognised as the same problem. Keying on
    // the attempt would make every retry a new alert, which is the behaviour being prevented.
    const block = domain.slice(domain.indexOf("eventBus.subscribe('payment.webhook.failed'"));
    expect(block.slice(0, 1500)).toMatch(/reference: invoiceId/);
  });
});

describe('the same invoice cannot alert twice', () => {
  it('handleShopEvent checks the reference before firing', () => {
    const block = scheduler.slice(
      scheduler.indexOf('async handleShopEvent('),
      scheduler.indexOf('async handleEventTrigger(')
    );
    expect(block).toContain('hasShopScopedSendForReference');
  });

  it('only checks when a reference was supplied', () => {
    // low_stock passes none — each sweep is a fresh look at the same shelf, and the emitter already
    // throttles. An unconditional check there would either no-op or, worse, match on NULL and silence
    // the alert entirely.
    const block = scheduler.slice(
      scheduler.indexOf('async handleShopEvent('),
      scheduler.indexOf('async handleEventTrigger(')
    );
    expect(block).toContain('data.reference &&');
  });

  it('matches a NULL customer explicitly rather than comparing to null', () => {
    // `customer_address = NULL` is never true in SQL, so a shared query with null passed in would
    // return false every time and dedup nothing — present, costly, and useless. That exact shape was
    // the bug in 67584cdc1, so the shop-scoped lookup gets its own IS NULL.
    const fn = repo.slice(repo.indexOf('async hasShopScopedSendForReference'));
    expect(fn.slice(0, 600)).toContain('customer_address IS NULL');
  });
});

// Everything above reads the source, which can only show the guard is WIRED. The bug it is guarding
// against was a guard that was wired and did nothing, so the dedup is also exercised here against the
// rows it actually writes — the standard set after 67584cdc1.
describe('behaviour: one invoice, one alert', () => {
  const { AutoMessageSchedulerService } = require('../../src/services/AutoMessageSchedulerService');

  const rule = (over: any = {}) => ({
    id: 'rule-sl',
    shopId: 'peanut',
    name: 'Subscription payment failed',
    messageTemplate: null,
    triggerType: 'event',
    eventType: 'subscription_lapsed',
    actionType: 'notify_staff',
    actionPayload: { message: 'Update your card.' },
    delayHours: 0,
    isActive: true,
    ...over,
  });

  const scheduler = () => {
    const recorded: any[] = [];
    const svc: any = new AutoMessageSchedulerService();
    svc.autoMessageRepo = {
      getActiveEventRules: jest.fn(async () => [rule()]),
      // Backed by what was recorded, so it behaves like the database instead of a constant. With a
      // broken guard nothing ever lands here and it keeps answering false — the live failure mode.
      hasShopScopedSendForReference: jest.fn(async (id: string, ref: string) =>
        recorded.some((r) => r.autoMessageId === id && r.customerAddress === null && r.triggerReference === ref)
      ),
      recordSend: jest.fn(async (s: any) => { recorded.push(s); return { id: `s${recorded.length}` }; }),
    };
    svc.shopRepo = { getShop: jest.fn(async () => ({ id: 'peanut', name: 'Peanut Repairs', active: true })) };
    svc.isShopEntitled = async () => true;
    return { svc, recorded };
  };

  beforeEach(() => mockRun.mockClear());

  it('alerts once for a failed invoice', async () => {
    const { svc, recorded } = scheduler();
    await svc.handleShopEvent('subscription_lapsed', { shopId: 'peanut', reference: 'in_123' });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].customerAddress).toBeNull();
    expect(recorded[0].triggerReference).toBe('in_123');
  });

  it('does NOT alert again when Stripe retries the same invoice', async () => {
    const { svc, recorded } = scheduler();
    await svc.handleShopEvent('subscription_lapsed', { shopId: 'peanut', reference: 'in_123' });
    await svc.handleShopEvent('subscription_lapsed', { shopId: 'peanut', reference: 'in_123' });
    expect(recorded).toHaveLength(1);
  });

  it('DOES alert for a different invoice', async () => {
    // Without this the test above proves nothing: a rule that never fires would also stay at one.
    const { svc, recorded } = scheduler();
    await svc.handleShopEvent('subscription_lapsed', { shopId: 'peanut', reference: 'in_123' });
    await svc.handleShopEvent('subscription_lapsed', { shopId: 'peanut', reference: 'in_456' });
    expect(recorded).toHaveLength(2);
  });

  it('still fires every time when there is no reference — low_stock is unaffected', async () => {
    const { svc, recorded } = scheduler();
    await svc.handleShopEvent('low_stock', { shopId: 'peanut', summary: '3 items low' });
    await svc.handleShopEvent('low_stock', { shopId: 'peanut', summary: '4 items low' });
    expect(recorded).toHaveLength(2);
  });
});
