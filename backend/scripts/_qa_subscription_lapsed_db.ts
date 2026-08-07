// WRITES TO STAGING. Verifies everything about `subscription_lapsed` EXCEPT the deployed webhook hop.
//
// The webhook route cannot be reached from here: staging's STRIPE_WEBHOOK_SECRET differs from the one
// in local .env, so a forged delivery is rejected — a signature made with our secret and a deliberately
// wrong one both return the same 400. That is Stripe behaving correctly, not a fault.
//
// So this covers the rest, and says plainly what it does not cover. The part worth having here that the
// unit tests cannot give: the dedup query runs against real Postgres. `customer_address IS NULL` is
// exactly the kind of SQL a mocked repository will happily agree with and a database will not.
//
// Still unverified after this: that the deployed handlePaymentFailed publishes payment.webhook.failed
// and that MessagingDomain's subscription is live in the running process. Closing that needs either
// staging's webhook secret or a genuinely failing test-mode invoice on a subscription Stripe delivers
// to staging.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import * as jwt from 'jsonwebtoken';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { autoMessageSchedulerService } from '../src/services/AutoMessageSchedulerService';

const SHOP = '1111';
const API = process.env.QA_API_BASE || 'https://api-staging.repaircoin.ai';

const ok = (c: boolean, s: string) => console.log(`  ${c ? 'PASS' : 'FAIL'}  ${s}`);
const line = (s: string) => console.log(s);

async function main() {
  const db = new Client({
    host: process.env.DB_HOST, port: +(process.env.DB_PORT || 25060),
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const shop = (await db.query(`SELECT wallet_address FROM shops WHERE shop_id=$1`, [SHOP])).rows[0];
  const token = jwt.sign(
    { address: shop.wallet_address, role: 'shop', shopId: SHOP },
    process.env.JWT_SECRET as string, { expiresIn: '30m' }
  );
  const api = async (method: string, url: string, body?: unknown) => {
    const r = await fetch(`${API}${url}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: (await r.json().catch(() => null)) as any };
  };

  const INV_A = `in_qa_${Date.now().toString(36)}`;
  const INV_B = `${INV_A}_b`;
  const sendsFor = async (ruleId: string) =>
    (await db.query(
      `SELECT trigger_reference, customer_address FROM auto_message_sends
        WHERE auto_message_id=$1 ORDER BY sent_at`, [ruleId]
    )).rows;

  let ruleId: string | null = null;
  try {
    line('\n=== 1. the deployed API accepts subscription_lapsed ===');
    const create = await api('POST', '/api/messages/auto-messages', {
      name: 'QA subscription_lapsed db',
      triggerType: 'event',
      eventType: 'subscription_lapsed',
      actionType: 'notify_staff',
      actionPayload: { message: 'QA — please ignore.' },
      surface: 'workflow',
      status: 'draft',
    });
    ok(create.status === 201, `created (${create.status}) ${create.body?.error || ''}`);
    if (create.status !== 201) return;
    ruleId = create.body.data.id;

    line('\n=== 2. the guard refuses a customer action on a shop event ===');
    const bad = await api('POST', '/api/messages/auto-messages', {
      name: 'QA should be refused',
      triggerType: 'event',
      eventType: 'subscription_lapsed',
      actionType: 'send_message',
      messageTemplate: 'hello',
      surface: 'workflow',
    });
    ok(bad.status === 400, `refused subscription_lapsed + send_message (${bad.status})`);
    line(`  reason: ${bad.body?.error}`);

    line('\n=== 3. a draft does not fire ===');
    await autoMessageSchedulerService.handleShopEvent('subscription_lapsed', { shopId: SHOP, reference: INV_A });
    ok((await sendsFor(ruleId)).length === 0, 'nothing alerted while the workflow is a draft');

    line('\n=== 4. publish, then fire ===');
    const pub = await api('PATCH', `/api/messages/auto-messages/${ruleId}/publish`);
    ok(pub.status === 200, `published (${pub.status})`);

    await autoMessageSchedulerService.handleShopEvent('subscription_lapsed', { shopId: SHOP, reference: INV_A });
    const first = await sendsFor(ruleId);
    ok(first.length === 1, `alerted once (got ${first.length})`);
    ok(first[0]?.customer_address === null, 'recorded with a NULL customer — nobody was invented');
    ok(first[0]?.trigger_reference === INV_A, 'recorded WHICH invoice caused it');

    line('\n=== 5. a retry of the SAME invoice must not alert again ===');
    // The real dedup query against real Postgres — the assertion a mock cannot make for us.
    await autoMessageSchedulerService.handleShopEvent('subscription_lapsed', { shopId: SHOP, reference: INV_A });
    ok((await sendsFor(ruleId)).length === 1, 'still one alert after a retry of the same invoice');

    line('\n=== 6. a DIFFERENT invoice does alert ===');
    await autoMessageSchedulerService.handleShopEvent('subscription_lapsed', { shopId: SHOP, reference: INV_B });
    ok((await sendsFor(ruleId)).length === 2, 'a new invoice produced a second alert');

    line('\n=== 7. low_stock, which passes no reference, is unaffected ===');
    // The guard is conditional. If it ever matched on a missing reference it would silence this
    // entirely, and silence is the failure mode nobody notices.
    const ls = await api('POST', '/api/messages/auto-messages', {
      name: 'QA low_stock unaffected',
      triggerType: 'event', eventType: 'low_stock', actionType: 'notify_staff',
      actionPayload: { message: 'QA — please ignore.' }, surface: 'workflow', status: 'draft',
    });
    const lsId = ls.body?.data?.id;
    if (lsId) {
      await api('PATCH', `/api/messages/auto-messages/${lsId}/publish`);
      await autoMessageSchedulerService.handleShopEvent('low_stock', { shopId: SHOP, summary: '3 items low' });
      await autoMessageSchedulerService.handleShopEvent('low_stock', { shopId: SHOP, summary: '4 items low' });
      ok((await sendsFor(lsId)).length === 2, 'low_stock still fires every time');
      await db.query(`DELETE FROM auto_message_sends WHERE auto_message_id=$1`, [lsId]);
      await fetch(`${API}/api/messages/auto-messages/${lsId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }

    line('\nNOT covered here: the deployed webhook publishing payment.webhook.failed. See the header.');
  } finally {
    if (ruleId) {
      await db.query(`DELETE FROM auto_message_sends WHERE auto_message_id=$1`, [ruleId]);
      await fetch(`${API}/api/messages/auto-messages/${ruleId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
      line(`\ncleaned up rule ${ruleId}`);
    }
    await db.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
