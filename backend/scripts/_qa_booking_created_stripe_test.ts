// Proves the publish WITHOUT a real card, by driving Stripe in test mode.
//
// The gap this closes: the e2e calls handleEventTrigger directly, so it never touches the code that was
// broken. The publish lives in PaymentService.handlePaymentSuccess, and only a completed payment gets
// there. A test-mode PaymentIntent confirmed with Stripe's test card reaches exactly the same code by
// exactly the same route — no real money, no card details, and crucially it runs on the DEPLOYED server
// rather than this laptop, so it proves what is actually running.
//
// Flow:
//   1. create a test-mode PaymentIntent carrying the same metadata the real checkout writes
//   2. confirm it with `pm_card_visa` (Stripe's test payment method)
//   3. POST it to the deployed /api/services/orders/confirm, which calls handlePaymentSuccess
//   4. the deployed server creates the order and — if the fix is live — publishes service.order_created
//
// WRITES TO STAGING: creates one real service_order for peanut. Prints the order id so it can be
// removed afterwards.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SHOP = 'peanut';
const API = process.env.QA_API_BASE || 'https://api-staging.repaircoin.ai';

const ok = (c: boolean, s: string) => console.log(`  ${c ? 'PASS' : 'FAIL'}  ${s}`);

async function main() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key.startsWith('sk_test')) {
    console.error(`refusing to run: STRIPE_SECRET_KEY is not a test key (${key.slice(0, 8)}…)`);
    process.exit(1);
  }
  const stripe = new Stripe(key, { apiVersion: '2024-06-20' as any });

  const db = new Client({
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT || 25060),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  // Real service, real customer — a fabricated pair would fail for reasons that have nothing to do
  // with the event.
  const service = (await db.query(
    `SELECT service_id, service_name, price_usd FROM shop_services
      WHERE shop_id=$1 AND active = true AND deleted_at IS NULL ORDER BY price_usd LIMIT 1`,
    [SHOP]
  )).rows[0];
  const customer = (await db.query(
    `SELECT DISTINCT customer_address FROM service_orders WHERE shop_id=$1 LIMIT 1`,
    [SHOP]
  )).rows[0];
  if (!service || !customer) {
    console.error('no active service or known customer on peanut — cannot build a realistic booking');
    process.exit(1);
  }

  const orderId = `qa-bc-${Date.now().toString(36)}`;
  const amountUsd = Number(service.price_usd) || 1;
  console.log(`\nservice : ${service.service_name} ($${amountUsd})`);
  console.log(`customer: ${customer.customer_address}`);
  console.log(`orderId : ${orderId}`);

  const rule = (await db.query(
    `SELECT id FROM shop_auto_messages WHERE shop_id=$1 AND event_type='booking_created' AND is_active = true`,
    [SHOP]
  )).rows;
  console.log(`active booking_created rules on ${SHOP}: ${rule.length}`);
  if (!rule.length) console.log('  (arm one first, or this proves the publish but shows no send)');

  console.log('\n=== 1. create + confirm a test-mode payment ===');
  let pi = await stripe.paymentIntents.create({
    amount: Math.max(50, Math.round(amountUsd * 100)),
    currency: 'usd',
    payment_method_types: ['card'],
    metadata: {
      orderId,
      serviceId: service.service_id,
      shopId: SHOP,
      customerAddress: customer.customer_address,
      totalAmount: String(amountUsd),
      rcnRedeemed: '0',
      rcnDiscountUsd: '0',
      finalAmountUsd: String(amountUsd),
      bookingDate: '',
      bookingTime: '',
      notes: 'QA — booking_created publish check',
      type: 'service_booking',
    },
  });
  pi = await stripe.paymentIntents.confirm(pi.id, { payment_method: 'pm_card_visa' });
  ok(pi.status === 'succeeded', `payment intent ${pi.id} → ${pi.status}`);
  if (pi.status !== 'succeeded') process.exit(1);

  console.log('\n=== 2. hand it to the DEPLOYED server, as the real confirm flow does ===');
  const r = await fetch(`${API}/api/services/orders/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentIntentId: pi.id }),
  });
  const body = (await r.json().catch(() => null)) as any;
  ok(r.ok, `confirm endpoint (${r.status}) ${r.ok ? '' : JSON.stringify(body)?.slice(0, 300)}`);

  console.log('\n=== 3. the order exists ===');
  const { rows: orders } = await db.query(
    `SELECT order_id, status, created_at FROM service_orders WHERE order_id=$1`,
    [orderId]
  );
  ok(orders.length === 1, `order row created (${orders.length})`);
  if (orders.length) console.log(`  status: ${orders[0].status}`);

  console.log('\n=== 4. did service.order_created reach the bus? ===');
  // The trigger firing IS the observation. Nothing else on this path writes a row when the event is
  // published, which is precisely why the gap went unnoticed for so long.
  //
  // Matched by TIME, not by trigger_reference. Keying on the reference conflated two questions — "did
  // the event fire" and "was the reference recorded" — so when the reference came back NULL this
  // reported that nothing had fired, which was false and sent me looking in the wrong place. The
  // reference is now its own assertion below.
  let sends: any[] = [];
  for (let i = 0; i < 10 && !sends.length; i++) {
    sends = (await db.query(
      `SELECT s.sent_at, s.status, s.trigger_reference, s.customer_address
         FROM auto_message_sends s
         JOIN shop_auto_messages m ON m.id = s.auto_message_id
        WHERE m.shop_id=$1 AND m.event_type='booking_created'
          AND s.sent_at >= (SELECT created_at FROM service_orders WHERE order_id=$2)`,
      [SHOP, orderId]
    )).rows;
    if (!sends.length) await new Promise((res) => setTimeout(res, 1500));
  }
  ok(sends.length > 0, `the booking_created trigger fired for ${orderId} (${sends.length} send)`);
  if (sends.length) {
    ok(
      sends.some((s) => s.trigger_reference === orderId),
      'the send recorded WHICH order caused it (null here = the dedup guard is dead)'
    );
  }
  sends.forEach((s) => console.log(`  ${s.sent_at.toISOString()}  ${s.status}  → ${s.customer_address}`));

  if (!sends.length && rule.length) {
    console.log('\n  A booking was created and no workflow fired. Either the deployed build predates the');
    console.log('  PaymentService change, or the publish threw — look for "Failed to publish');
    console.log('  service.order_created" in the backend log.');
  }

  console.log(`\ncleanup: DELETE FROM service_orders WHERE order_id = '${orderId}';`);
  await db.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
