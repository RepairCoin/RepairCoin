// Custom Workflows §9.3 — the `new_ad_lead` trigger.
//
// The event already existed (`ads:lead_captured`); what it lacked was the one field an automation
// cannot work without. Automations are keyed on shopId, and `ad_leads` has no shop of its own — the
// shop is only reachable through campaign_id → ad_campaigns.shop_id. Adding it to the payload is the
// whole trigger.
//
// It is SHOP-scoped on purpose. An ad lead is a name and a phone number, not a platform customer:
// there is no wallet to message and nobody to credit RCN to until they convert. The useful automation
// is "tell the team to ring them".

import * as fs from 'fs';
import * as path from 'path';

const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

const attribution = read('src', 'domains', 'AdsDomain', 'services', 'LeadAttributionService.ts');
const messaging = read('src', 'domains', 'messaging', 'index.ts');
const controller = read('src', 'domains', 'messaging', 'controllers', 'AutoMessageController.ts');

describe('the event carries a shop', () => {
  it('publishes shopId alongside the existing fields', () => {
    const publish = attribution.slice(attribution.indexOf('AdsEvents.LEAD_CAPTURED'));
    expect(publish).toMatch(/campaignId,\s*creativeId,\s*method: raw\.method,\s*shopId/);
  });

  // Additive: subscribers that already read campaignId/creativeId/method must not have to change.
  it('keeps the fields subscribers already read', () => {
    const publish = attribution.slice(attribution.indexOf('AdsEvents.LEAD_CAPTURED'));
    for (const field of ['campaignId', 'creativeId', 'method']) {
      expect(publish).toContain(field);
    }
  });

  // A campaign lookup failing must not stop a captured lead from being recorded — the lead is the
  // thing of value; the automation is a bonus on top of it.
  it('resolves the shop best-effort rather than letting a lookup failure lose the lead', () => {
    expect(attribution).toMatch(/try\s*\{[^}]*campaigns\.findById[^}]*\}\s*catch/s);
  });
});

describe('the trigger', () => {
  it('is subscribed and routed to the shop-scoped path', () => {
    const block = messaging.slice(
      messaging.indexOf("eventBus.subscribe('ads:lead_captured'"),
      messaging.indexOf("eventBus.subscribe('inventory:low_stock_alert'")
    );
    expect(block).toContain("handleShopEvent('new_ad_lead'");
  });

  // Without a shop the automation is either a no-op or, worse, attributed to the wrong shop.
  it('skips when the payload has no shopId', () => {
    const block = messaging.slice(messaging.indexOf("eventBus.subscribe('ads:lead_captured'"));
    expect(block.slice(0, 600)).toMatch(/if \(!shopId\) return;/);
  });

  it('is accepted by the API and declared shop-scoped', () => {
    expect(controller).toMatch(/'new_ad_lead'/);
    expect(controller).toMatch(/SHOP_SCOPED_EVENTS = new Set\(\[[^\]]*'new_ad_lead'/);
  });
});
