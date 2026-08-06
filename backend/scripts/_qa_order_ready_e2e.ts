// WRITES TO STAGING — end-to-end test of `order_ready` against the DEPLOYED API.
//
// The idempotency is the part worth proving. It is a WHERE-clause race guard on a button shops will
// double-click, and the cost of it failing is a customer told twice to come and collect the same
// thing. So the assertions run in both directions: a second press must not fire the workflow, and a
// DIFFERENT order must still fire it — without which a rule that never fires would pass just as well.
//
// Also checks the guard that stops a shop telling someone to collect a cancelled order. That is a
// wasted trip for a real person, which is worse than saying nothing.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import * as jwt from 'jsonwebtoken';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SHOP = 'peanut';
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

  // Two real collectable orders plus one cancelled, so every branch is exercised against real rows.
  const collectable = (await db.query(
    `SELECT order_id, customer_address FROM service_orders
      WHERE shop_id=$1 AND status IN ('paid','approved','scheduled','completed') AND ready_notified_at IS NULL
      ORDER BY created_at DESC LIMIT 2`, [SHOP]
  )).rows;
  const cancelled = (await db.query(
    `SELECT order_id FROM service_orders WHERE shop_id=$1 AND status IN ('cancelled','refunded','no_show') LIMIT 1`,
    [SHOP]
  )).rows[0];

  if (collectable.length < 2) {
    console.error(`peanut has ${collectable.length} un-notified collectable orders; need 2`);
    process.exit(1);
  }
  const [A, B] = collectable;
  line(`\norders: A=${A.order_id}  B=${B.order_id}  cancelled=${cancelled?.order_id ?? 'none found'}`);

  let ruleId: string | null = null;
  const touched = [A.order_id, B.order_id];
  try {
    line('\n=== 1. the API accepts order_ready with a customer-facing action ===');
    // Customer-scoped, unlike low_stock — so send_message must be allowed, not refused.
    const create = await api('POST', '/api/messages/auto-messages', {
      name: 'QA order_ready e2e',
      triggerType: 'event',
      eventType: 'order_ready',
      actionType: 'send_message',
      messageTemplate: 'Hi {{customerName}}, QA test for order_ready — please ignore.',
      delayHours: 0,
      targetAudience: 'all',
      maxSendsPerCustomer: 5,
      surface: 'workflow',
      status: 'draft',
    });
    ok(create.status === 201, `created (${create.status}) ${create.body?.error || ''}`);
    if (create.status !== 201) return;
    ruleId = create.body.data.id;
    await api('PATCH', `/api/messages/auto-messages/${ruleId}/publish`);

    const sends = async () =>
      (await db.query(
        `SELECT trigger_reference FROM auto_message_sends WHERE auto_message_id=$1`, [ruleId]
      )).rows;

    line('\n=== 2. pressing the button notifies and fires the workflow ===');
    const first = await api('POST', `/api/services/orders/${A.order_id}/notify-ready`);
    ok(first.status === 200, `notify-ready (${first.status}) ${first.body?.error || ''}`);
    ok(first.body?.data?.alreadyNotified === false, 'reported as a first notification');

    let after = await sends();
    for (let i = 0; i < 8 && !after.length; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      after = await sends();
    }
    ok(after.length === 1, `the workflow fired once (got ${after.length})`);
    ok(after[0]?.trigger_reference === A.order_id, 'recorded WHICH order caused it');

    const stamped = (await db.query(
      `SELECT ready_notified_at, status FROM service_orders WHERE order_id=$1`, [A.order_id]
    )).rows[0];
    ok(!!stamped.ready_notified_at, 'ready_notified_at was stamped');

    line('\n=== 3. the order STATUS is untouched — this is not a lifecycle stage ===');
    ok(
      ['paid', 'approved', 'scheduled', 'completed'].includes(stamped.status),
      `status still ${stamped.status}, not a "ready" value`
    );

    line('\n=== 4. a second press does nothing ===');
    const second = await api('POST', `/api/services/orders/${A.order_id}/notify-ready`);
    ok(second.status === 200, `still 200, not an error (${second.status})`);
    ok(second.body?.data?.alreadyNotified === true, 'reported as already notified');
    await new Promise((r) => setTimeout(r, 3000));
    ok((await sends()).length === 1, 'the workflow did NOT fire again');

    line('\n=== 5. a DIFFERENT order does fire ===');
    // Without this, step 4 proves nothing — a rule that never fires would also stay at one.
    const other = await api('POST', `/api/services/orders/${B.order_id}/notify-ready`);
    ok(other.status === 200, `notify-ready on a second order (${other.status})`);
    let two = await sends();
    for (let i = 0; i < 8 && two.length < 2; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      two = await sends();
    }
    ok(two.length === 2, `a second order produced a second send (got ${two.length})`);

    line('\n=== 6. an order nobody can collect is refused ===');
    if (cancelled) {
      const bad = await api('POST', `/api/services/orders/${cancelled.order_id}/notify-ready`);
      ok(bad.status === 400, `refused a cancelled/refunded/no-show order (${bad.status})`);
      line(`  reason: ${bad.body?.error}`);
    } else {
      line('  SKIPPED — no cancelled order on this shop to test against');
    }

    line('\n=== 7. another shop cannot notify on this order ===');
    const other2 = jwt.sign(
      { address: '0x000000000000000000000000000000000000dead', role: 'shop', shopId: '1111' },
      process.env.JWT_SECRET as string, { expiresIn: '5m' }
    );
    const stolen = await fetch(`${API}/api/services/orders/${A.order_id}/notify-ready`, {
      method: 'POST', headers: { Authorization: `Bearer ${other2}`, 'Content-Type': 'application/json' },
    });
    ok(stolen.status === 403 || stolen.status === 404, `another shop refused (${stolen.status})`);
  } finally {
    line('\ncleanup');
    if (ruleId) {
      await db.query(`DELETE FROM auto_message_sends WHERE auto_message_id=$1`, [ruleId]);
      await fetch(`${API}/api/messages/auto-messages/${ruleId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
      line(`  removed rule ${ruleId}`);
    }
    // Put the orders back so the next run has un-notified rows to work with.
    await db.query(
      `UPDATE service_orders SET ready_notified_at = NULL WHERE order_id = ANY($1::varchar[])`,
      [touched]
    );
    line(`  cleared ready_notified_at on ${touched.length} order(s)`);
    await db.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
