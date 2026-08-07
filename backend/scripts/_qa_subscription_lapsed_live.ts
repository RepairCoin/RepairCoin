// WRITES TO STAGING — verifies `subscription_lapsed` against the DEPLOYED webhook handler.
//
// Same idea as the booking_created Stripe test: exercise the real path rather than the local copy of
// it. Here that means a properly SIGNED `invoice.payment_failed` posted to the deployed Stripe webhook
// endpoint — the technique `stripe trigger` uses, with our own staging secret, against our own system.
//
// It has to be a shop with a row in `stripe_subscriptions`, because handlePaymentFailed resolves the
// shop through it and returns early otherwise. peanut has none; shop `1111` does.
//
// Side effects on staging, all cleaned up at the end: one payment-attempt row, one shop notification,
// and the sends from the QA rule.
//
// Usage: npx ts-node scripts/_qa_subscription_lapsed_live.ts

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import * as jwt from 'jsonwebtoken';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SHOP = '1111';
const API = process.env.QA_API_BASE || 'https://api-staging.repaircoin.ai';
const RULE_NAME = 'QA subscription_lapsed live';

const ok = (c: boolean, s: string) => console.log(`  ${c ? 'PASS' : 'FAIL'}  ${s}`);
const line = (s: string) => console.log(s);

async function main() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret.startsWith('whsec_')) {
    console.error('no STRIPE_WEBHOOK_SECRET — cannot sign a webhook');
    process.exit(1);
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' as any });

  const db = new Client({
    host: process.env.DB_HOST, port: +(process.env.DB_PORT || 25060),
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const sub = (await db.query(
    `SELECT stripe_subscription_id FROM stripe_subscriptions WHERE shop_id=$1 LIMIT 1`, [SHOP]
  )).rows[0];
  if (!sub) { console.error(`shop ${SHOP} has no stripe_subscriptions row`); process.exit(1); }
  line(`\nshop ${SHOP}, subscription ${sub.stripe_subscription_id}`);

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

  /** A signed invoice.payment_failed, as Stripe would deliver it. */
  const postWebhook = async (invoiceId: string, attempt: number) => {
    const payload = JSON.stringify({
      id: `evt_qa_${invoiceId}_${attempt}`,
      object: 'event',
      type: 'invoice.payment_failed',
      created: Math.floor(Number(process.env.QA_NOW || Date.now()) / 1000),
      data: {
        object: {
          id: invoiceId,
          object: 'invoice',
          subscription: sub.stripe_subscription_id,
          attempt_count: attempt,
          amount_due: 50000,
          currency: 'usd',
          status: 'open',
          payment_intent: `pi_qa_${invoiceId}`,
        },
      },
    });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const r = await fetch(`${API}/api/shops/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
      body: payload,
    });
    return { status: r.status, text: await r.text().catch(() => '') };
  };

  const sendsFor = async (ruleId: string) =>
    (await db.query(
      `SELECT trigger_reference, customer_address, sent_at FROM auto_message_sends
        WHERE auto_message_id=$1 ORDER BY sent_at`, [ruleId]
    )).rows;

  const INV_A = `in_qa_${Date.now().toString(36)}`;
  const INV_B = `${INV_A}_b`;
  let ruleId: string | null = null;

  try {
    line('\n=== 1. arm a published subscription_lapsed rule ===');
    const create = await api('POST', '/api/messages/auto-messages', {
      name: RULE_NAME,
      triggerType: 'event',
      eventType: 'subscription_lapsed',
      actionType: 'notify_staff',
      actionPayload: { message: 'QA — subscription payment failed. Please ignore.' },
      surface: 'workflow',
      status: 'draft',
    });
    ok(create.status === 201, `created (${create.status}) ${create.body?.error || ''}`);
    if (create.status !== 201) return;
    ruleId = create.body.data.id;
    const pub = await api('PATCH', `/api/messages/auto-messages/${ruleId}/publish`);
    ok(pub.status === 200, `published (${pub.status})`);

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

    line('\n=== 3. a signed invoice.payment_failed reaches the deployed webhook ===');
    const w1 = await postWebhook(INV_A, 1);
    ok(w1.status >= 200 && w1.status < 300, `webhook accepted (${w1.status}) ${w1.text.slice(0, 120)}`);

    // The webhook returns before the bus listener has necessarily finished.
    let sends = await sendsFor(ruleId!);
    for (let i = 0; i < 8 && !sends.length; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      sends = await sendsFor(ruleId!);
    }
    ok(sends.length === 1, `the workflow fired once (got ${sends.length})`);
    ok(sends[0]?.customer_address === null, 'recorded with a NULL customer — nobody was invented');
    ok(sends[0]?.trigger_reference === INV_A, 'recorded WHICH invoice caused it');

    line('\n=== 4. Stripe retries the SAME invoice — must not alert again ===');
    await postWebhook(INV_A, 2);
    await new Promise((r) => setTimeout(r, 4000));
    ok((await sendsFor(ruleId!)).length === 1, 'still one alert after a retry of the same invoice');

    line('\n=== 5. a DIFFERENT invoice does alert ===');
    // Without this, step 4 proves nothing — a rule that never fires would also stay at one.
    await postWebhook(INV_B, 1);
    let after = await sendsFor(ruleId!);
    for (let i = 0; i < 8 && after.length < 2; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      after = await sendsFor(ruleId!);
    }
    ok(after.length === 2, `a new invoice produced a second alert (got ${after.length})`);
  } finally {
    line('\ncleanup');
    if (ruleId) {
      await db.query(`DELETE FROM auto_message_sends WHERE auto_message_id=$1`, [ruleId]);
      await fetch(`${API}/api/messages/auto-messages/${ruleId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
      line(`  removed rule ${ruleId}`);
    }
    const pa = await db.query(
      `DELETE FROM stripe_payment_attempts WHERE stripe_invoice_id LIKE 'in_qa_%' RETURNING id`
    ).catch(() => ({ rowCount: 0 } as any));
    line(`  removed ${pa.rowCount ?? 0} QA payment-attempt rows`);
    await db.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
