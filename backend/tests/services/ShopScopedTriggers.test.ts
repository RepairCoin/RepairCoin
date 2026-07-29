// low_stock — the first SHOP-scoped trigger.
//
// Every other trigger targets a customer: the engine resolves an audience and runs the action once per
// person. This one happens to the shop, with nobody involved — which is why it needed notify_staff
// first, and why it needs its own execution path.
//
// The rules worth protecting, all of which fail silently if broken:
//   - the API refuses a shop-scoped rule wired to a customer action (it would never have a recipient)
//   - the automation does NOT re-implement de-duplication (the emitter already throttles)
//   - the send is recorded with a NULL customer, not a fabricated one

import * as fs from 'fs';
import * as path from 'path';

const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', ...p), 'utf8');
const controller = read('domains', 'messaging', 'controllers', 'AutoMessageController.ts');
const domain = read('domains', 'messaging', 'index.ts');
const scheduler = read('services', 'AutoMessageSchedulerService.ts');

describe('low_stock — shop-scoped trigger', () => {
  it('is offered as a trigger', () => {
    expect(controller).toContain("'low_stock'");
  });

  it('is declared shop-scoped, so the API can reject customer actions on it', () => {
    expect(controller).toContain('SHOP_SCOPED_EVENTS');
    expect(controller).toMatch(/SHOP_SCOPED_EVENTS\s*=\s*new Set\(\['low_stock'\]\)/);
  });

  // A low_stock rule set to "send a message" has nobody to send to. Rejected at write time rather
  // than sitting in the list looking active while quietly doing nothing.
  it('rejects a shop-scoped rule that would need a recipient', () => {
    expect(controller).toContain('SHOP_SCOPED_EVENTS.has(eventType) && !NON_MESSAGING_ACTIONS.has(actionType)');
  });

  it('subscribes to the event the inventory service already publishes', () => {
    expect(domain).toContain("eventBus.subscribe('inventory:low_stock_alert'");
    expect(domain).toContain("handleShopEvent('low_stock'");
  });

  it('runs through a dedicated shop-scoped path, not the customer one', () => {
    expect(scheduler).toContain('async handleShopEvent(');
  });

  // The emitter (LowStockAlertService) already throttles per item and honours the shop's digest
  // preference. A second notion of "have we already said this" would eventually produce duplicates or
  // silence depending on which won.
  it('records the run with a NULL customer instead of inventing one', () => {
    const body = scheduler.slice(scheduler.indexOf('async handleShopEvent('), scheduler.indexOf('async handleEventTrigger('));
    expect(body).toContain('customerAddress: null');
    expect(body).not.toContain('countSendsForCustomer');
    expect(body).not.toContain('hasSentToday');
  });

  it('still respects the Business entitlement gate', () => {
    const body = scheduler.slice(scheduler.indexOf('async handleShopEvent('), scheduler.indexOf('async handleEventTrigger('));
    expect(body).toContain('isShopEntitled');
  });
});
