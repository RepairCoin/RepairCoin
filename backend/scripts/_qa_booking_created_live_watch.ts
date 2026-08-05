// Proves the half no script can prove on its own: that a REAL booking publishes service.order_created.
//
// The e2e calls handleEventTrigger directly, which skips the publish entirely — it proves the trigger
// works given the event, not that the event ever arrives. Only a real Stripe booking exercises
// PaymentService.handlePaymentSuccess, which is where the publish was missing.
//
// Usage:
//   npx ts-node scripts/_qa_booking_created_live_watch.ts arm     — create a published rule, note the time
//   npx ts-node scripts/_qa_booking_created_live_watch.ts check   — did a real booking fire it?
//   npx ts-node scripts/_qa_booking_created_live_watch.ts clean   — remove the rule
//
// WRITES TO STAGING. `arm` leaves a live rule that will send one in-app message to whoever books at
// peanut, so run `clean` when done.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import * as jwt from 'jsonwebtoken';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SHOP = 'peanut';
const API = process.env.QA_API_BASE || 'https://api-staging.repaircoin.ai';
const RULE_NAME = 'QA live booking_created watch';

async function main() {
  const mode = (process.argv[2] || 'check').toLowerCase();
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
    { expiresIn: '60m' }
  );
  const api = async (method: string, url: string, body?: unknown) => {
    const r = await fetch(`${API}${url}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: (await r.json().catch(() => null)) as any };
  };

  const findRule = async () =>
    (await db.query(
      `SELECT id, created_at FROM shop_auto_messages WHERE shop_id=$1 AND name=$2`,
      [SHOP, RULE_NAME]
    )).rows[0];

  if (mode === 'arm') {
    const existing = await findRule();
    if (existing) {
      console.log(`already armed: rule ${existing.id} (created ${existing.created_at.toISOString()})`);
    } else {
      const create = await api('POST', '/api/messages/auto-messages', {
        name: RULE_NAME,
        triggerType: 'event',
        eventType: 'booking_created',
        actionType: 'send_message',
        messageTemplate: 'Hi {{customerName}}, this is a QA check from {{shopName}} — please ignore.',
        delayHours: 0,
        targetAudience: 'all',
        maxSendsPerCustomer: 5,
        surface: 'workflow',
        status: 'draft',
      });
      if (create.status !== 201) {
        console.error(`could not create rule (${create.status}): ${create.body?.error}`);
        process.exit(1);
      }
      const id = create.body.data.id;
      const pub = await api('PATCH', `/api/messages/auto-messages/${id}/publish`);
      console.log(`armed: rule ${id}, published (${pub.status})`);
    }
    console.log('\nNow make a real booking at peanut on staging (pay through Stripe — the publish only');
    console.log('happens on a completed payment), then run: ... _qa_booking_created_live_watch.ts check');
    await db.end();
    return;
  }

  const rule = await findRule();
  if (!rule) {
    console.log('not armed — run `arm` first');
    await db.end();
    return;
  }

  if (mode === 'clean') {
    await db.query(`DELETE FROM auto_message_sends WHERE auto_message_id=$1`, [rule.id]);
    await api('DELETE', `/api/messages/auto-messages/${rule.id}`);
    console.log(`removed rule ${rule.id}`);
    await db.end();
    return;
  }

  // check
  console.log(`rule armed at ${rule.created_at.toISOString()}\n`);

  const { rows: orders } = await db.query(
    `SELECT order_id, customer_address, status, created_at
       FROM service_orders
      WHERE shop_id=$1 AND created_at > $2
      ORDER BY created_at`,
    [SHOP, rule.created_at]
  );
  console.log(`bookings created since arming: ${orders.length}`);
  orders.forEach((o: any) =>
    console.log(`  ${o.created_at.toISOString().slice(11, 19)}  ${o.status.padEnd(9)} ${o.order_id}`)
  );

  const { rows: sends } = await db.query(
    `SELECT customer_address, trigger_reference, sent_at, status
       FROM auto_message_sends WHERE auto_message_id=$1 ORDER BY sent_at`,
    [rule.id]
  );
  console.log(`\ntimes the trigger fired: ${sends.length}`);
  sends.forEach((s: any) =>
    console.log(`  ${s.sent_at.toISOString().slice(11, 19)}  ${s.status.padEnd(7)} order=${s.trigger_reference}`)
  );

  console.log();
  if (!orders.length) {
    console.log('INCONCLUSIVE — no booking has been made yet, so nothing could have fired.');
  } else if (sends.length) {
    const matched = orders.filter((o: any) => sends.some((s: any) => s.trigger_reference === o.order_id));
    console.log(`PASS — a real booking published service.order_created and the trigger fired.`);
    console.log(`       ${matched.length}/${orders.length} bookings matched to a send by order id.`);
  } else {
    console.log('FAIL — a booking exists but the trigger never fired. The publish is not reaching the bus.');
    console.log('       Check the backend log for "Failed to publish service.order_created", and confirm');
    console.log('       the deployed build actually contains the PaymentService change.');
  }

  await db.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
