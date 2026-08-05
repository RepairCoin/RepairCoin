// WRITES TO STAGING — creates a workflow rule and sends one in-app message. Run only when authorized.
//
// End-to-end test of the `booking_created` trigger, over the real API (so the pairing guard is in the
// path) and the real engine entry point the subscription calls.
//
// What this DOES cover: the API accepts the new event type, the guard still refuses a pairing with
// nothing to act on, a draft rule stays inert, a published one sends exactly once, and the same order
// cannot fire it twice.
//
// What this does NOT cover, and no script can: that `PaymentService` actually publishes
// `service.order_created` on a real Stripe booking. That is the half of this feature that was broken
// before, and it is only provable by making a real booking on staging and watching a message arrive.
// AutomationTriggers.test.ts pins the publish at the source; the browser pass proves it fires.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import * as jwt from 'jsonwebtoken';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { autoMessageSchedulerService } from '../src/services/AutoMessageSchedulerService';

const SHOP = 'peanut';
const API = process.env.QA_API_BASE || 'https://api-staging.repaircoin.ai';

const line = (s: string) => console.log(s);
const ok = (c: boolean, s: string) => console.log(`  ${c ? 'PASS' : 'FAIL'}  ${s}`);

async function main() {
  const db = new Client({
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT || 25060),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const shop = (await db.query(`SELECT wallet_address FROM shops WHERE shop_id=$1`, [SHOP])).rows[0];
  const token = jwt.sign(
    { address: shop.wallet_address, role: 'shop', shopId: SHOP },
    process.env.JWT_SECRET as string,
    { expiresIn: '30m' }
  );
  const api = async (method: string, url: string, body?: unknown) => {
    const r = await fetch(`${API}${url}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: (await r.json().catch(() => null)) as any };
  };

  // A customer who has actually transacted with this shop, so the send has a real conversation to land
  // in rather than manufacturing one.
  const customer = (await db.query(
    `SELECT DISTINCT customer_address FROM service_orders WHERE shop_id=$1 LIMIT 1`,
    [SHOP]
  )).rows[0];
  const ORDER_REF = `qa-booking-created-${Date.now().toString(36)}`;

  const sendsFor = async (ruleId: string) =>
    (await db.query(`SELECT id, trigger_reference FROM auto_message_sends WHERE auto_message_id=$1`, [ruleId])).rows;

  let ruleId: string | null = null;
  try {
    line('\n=== 1. the API accepts booking_created ===');
    const create = await api('POST', '/api/messages/auto-messages', {
      name: 'QA booking_created e2e',
      triggerType: 'event',
      eventType: 'booking_created',
      actionType: 'send_message',
      messageTemplate: 'Hi {{customerName}}, QA test for booking_created — please ignore.',
      delayHours: 0,
      targetAudience: 'all',
      maxSendsPerCustomer: 1,
      surface: 'workflow',
      status: 'draft',
    });
    ok(create.status === 201, `created (${create.status}) ${create.body?.error || ''}`);
    ruleId = create.body?.data?.id ?? null;

    // Fail loudly rather than reporting five confusing failures. The API is the DEPLOYED backend, so
    // this script is meaningless until the branch is on it.
    if (create.status === 400 && /eventType must be one of/.test(create.body?.error || '')) {
      line('\n  The deployed API does not know booking_created yet — deploy the branch, then re-run.');
      line('  Everything below would fail for that reason alone and would tell you nothing.');
      return;
    }

    line('\n=== 2. the guard still refuses a pairing with no audience ===');
    // booking_created happens to ONE customer, so a whole-audience action has no group to send to.
    const bad = await api('POST', '/api/messages/auto-messages', {
      name: 'QA should be refused',
      triggerType: 'event',
      eventType: 'booking_created',
      actionType: 'run_campaign',
      surface: 'workflow',
    });
    // Asserting the STATUS alone is a false green: an API that has never heard of booking_created also
    // answers 400, so this check passed on a backend that could not run the feature at all. The reason
    // is the assertion — it has to be refused for the pairing, not for the event type.
    const refusedForPairing =
      bad.status === 400 && /audience|one customer at a time/i.test(bad.body?.error || '');
    ok(refusedForPairing, `refused booking_created + run_campaign FOR THE PAIRING (${bad.status})`);
    line(`  reason: ${bad.body?.error}`);

    line('\n=== 3. a draft does not fire ===');
    await autoMessageSchedulerService.handleEventTrigger('booking_created', {
      shopId: SHOP,
      customerAddress: customer.customer_address,
      orderId: ORDER_REF,
    });
    ok((await sendsFor(ruleId!)).length === 0, 'nothing sent while the workflow is a draft');

    line('\n=== 4. publish, then fire ===');
    const pub = await api('PATCH', `/api/messages/auto-messages/${ruleId}/publish`);
    ok(pub.status === 200, `published (${pub.status})`);

    await autoMessageSchedulerService.handleEventTrigger('booking_created', {
      shopId: SHOP,
      customerAddress: customer.customer_address,
      orderId: ORDER_REF,
    });
    const first = await sendsFor(ruleId!);
    ok(first.length === 1, `sent exactly once (got ${first.length})`);

    line('\n=== 5. the same booking cannot fire it twice ===');
    // hasSendForTriggerReference — a webhook retry must not message the customer again.
    await autoMessageSchedulerService.handleEventTrigger('booking_created', {
      shopId: SHOP,
      customerAddress: customer.customer_address,
      orderId: ORDER_REF,
    });
    ok((await sendsFor(ruleId!)).length === 1, 'still one send after a repeat of the same order');

    line('\n=== 6. a DIFFERENT booking is capped by maxSendsPerCustomer ===');
    await autoMessageSchedulerService.handleEventTrigger('booking_created', {
      shopId: SHOP,
      customerAddress: customer.customer_address,
      orderId: `${ORDER_REF}-second`,
    });
    ok((await sendsFor(ruleId!)).length === 1, 'maxSendsPerCustomer=1 held for a new order');
  } finally {
    if (ruleId) {
      await db.query(`DELETE FROM auto_message_sends WHERE auto_message_id=$1`, [ruleId]);
      await fetch(`${API}/api/messages/auto-messages/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
      line(`\ncleaned up rule ${ruleId}`);
    }
    await db.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
