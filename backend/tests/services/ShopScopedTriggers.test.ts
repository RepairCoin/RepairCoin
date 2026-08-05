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

  // Asserts MEMBERSHIP, not the whole list. This used to pin the set to exactly ['low_stock'], which
  // made it fail the moment new_ad_lead became the second shop-scoped trigger — a test failing on a
  // correct change, because it asserted the contents of a list instead of the property it cares about.
  it('is declared shop-scoped, so the API can reject customer actions on it', () => {
    expect(controller).toMatch(/SHOP_SCOPED_EVENTS\s*=\s*new Set\(\[[^\]]*'low_stock'/);
  });

  // A low_stock rule set to "send a message" has nobody to send to. Rejected at write time rather
  // than sitting in the list looking active while quietly doing nothing.
  //
  // Keyed on SHOP_SCOPED_ACTIONS since 2026-07-30. It used to read NO_TEMPLATE_ACTIONS, which
  // contains issue_reward — an action that sends no message but still needs somebody to pay — so
  // "low stock → issue 25 RCN" passed validation and could only ever fail.
  // The rule is now general — actionFitsTrigger pairs what an action NEEDS against what a trigger
  // PROVIDES — and a shop-scoped event provides nothing, so this case falls out of it rather than
  // being its own check. The behaviour is unchanged; it is simply no longer a special case.
  it('rejects a shop-scoped rule that would need a recipient', () => {
    expect(controller).toContain('actionFitsTrigger(actionType, triggerType, eventType)');
  });

  it('applies the same coherence rule on update, not just create', () => {
    expect(controller).toContain('actionFitsTrigger(effectiveActionType');
  });

  it('subscribes to the event the inventory service already publishes', () => {
    expect(domain).toContain("eventBus.subscribe('inventory:low_stock_alert'");
    expect(domain).toContain("handleShopEvent('low_stock'");
  });

  it('runs through a dedicated shop-scoped path, not the customer one', () => {
    expect(scheduler).toContain('async handleShopEvent(');
  });

  /**
   * The shop-scoped region: the fireShopScopedRule helper plus handleShopEvent, which is everything
   * between the helper and the next customer-facing entry point.
   *
   * Anchored at the helper rather than handleShopEvent because the recordSend moved into it when the
   * scheduled path started sharing it — a source-shape test's weakness is exactly this, so if it moves
   * again, widen the anchor rather than dropping the assertion. The behavioural version of this claim
   * lives in AutoMessageShopScopedFanout.test.ts, which asserts the recorded send directly.
   */
  const shopScopedPath = () =>
    scheduler.slice(
      scheduler.indexOf('private async fireShopScopedRule('),
      scheduler.indexOf('async handleEventTrigger(')
    );

  it('records the run with a NULL customer instead of inventing one', () => {
    expect(shopScopedPath()).toContain('customerAddress: null');
  });

  // De-duplication is deliberately absent from the EVENT path: the emitter (LowStockAlertService)
  // already throttles per item and honours the shop's digest preference, and a second notion of "have
  // we already said this" would eventually produce duplicates or silence depending on which won.
  //
  // Note this is specifically about the event path. A shop-scoped action on a SCHEDULE has no emitter
  // throttling it, so that path does cap itself at one alert per day (hasSentTodayShopScoped) — which
  // is why this assertion is scoped to the region above rather than the whole file.
  it('does not re-implement de-duplication on the event path', () => {
    const body = shopScopedPath();
    expect(body).not.toContain('countSendsForCustomer');
    expect(body).not.toContain('hasSentToday');
  });

  it('still respects the Business entitlement gate', () => {
    // The check sits in handleShopEvent, before the batch — the helper leaves it to its callers so the
    // scheduled path can check per rule, where sendToCustomer would have.
    const body = scheduler.slice(
      scheduler.indexOf('async handleShopEvent('),
      scheduler.indexOf('async handleEventTrigger(')
    );
    expect(body).toContain('isShopEntitled');
  });
});
