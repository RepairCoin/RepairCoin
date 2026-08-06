// WRITES TO STAGING — end-to-end test of the `create_task` action against the DEPLOYED API.
//
// The dedup boundary is the part worth proving here, because it is a judgement call rather than a
// mechanical rule: a recurring trigger must not stack copies of the same reminder, but a monthly
// "chase the supplier" that could only ever be created once would be useless after the first month.
// So the assertions run in both directions — no duplicate while one is open, and a NEW task once it
// is closed. A test that only checked the first would pass for an action that files once and never
// again.
//
// Uses the real engine entry point rather than a mock, and the real HTTP API for the surface, so the
// route auth and the shop scoping are in the path too.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import * as jwt from 'jsonwebtoken';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { autoMessageSchedulerService } from '../src/services/AutoMessageSchedulerService';

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

  const tasksFor = async (ruleId: string) =>
    (await db.query(
      `SELECT id, title, body, status, source, customer_address FROM shop_tasks
        WHERE source_rule_id=$1 ORDER BY created_at`, [ruleId]
    )).rows;

  let ruleId: string | null = null;
  const madeByHand: string[] = [];
  try {
    line('\n=== 1. the API accepts create_task on a shop-scoped trigger ===');
    const create = await api('POST', '/api/messages/auto-messages', {
      name: 'QA create_task e2e',
      triggerType: 'event',
      eventType: 'low_stock',
      actionType: 'create_task',
      actionPayload: { title: 'QA — restock the back glass' },
      surface: 'workflow',
      status: 'draft',
    });
    ok(create.status === 201, `created (${create.status}) ${create.body?.error || ''}`);
    if (create.status !== 201) return;
    ruleId = create.body.data.id;

    line('\n=== 2. a draft files nothing ===');
    await autoMessageSchedulerService.handleShopEvent('low_stock', { shopId: SHOP, summary: '3 items low' });
    ok((await tasksFor(ruleId!)).length === 0, 'no task while the workflow is a draft');

    line('\n=== 3. publish, then fire ===');
    const pub = await api('PATCH', `/api/messages/auto-messages/${ruleId}/publish`);
    ok(pub.status === 200, `published (${pub.status})`);

    await autoMessageSchedulerService.handleShopEvent('low_stock', { shopId: SHOP, summary: '3 items low' });
    const first = await tasksFor(ruleId!);
    ok(first.length === 1, `one task filed (got ${first.length})`);
    ok(first[0]?.title === 'QA — restock the back glass', 'used the configured title');
    ok(first[0]?.body === '3 items low', 'body carries the LIVE trigger detail, not the stored wording');
    ok(first[0]?.source === 'workflow', 'marked as workflow-created, not manual');
    ok(first[0]?.customer_address === null, 'no customer invented for a shop-scoped trigger');

    line('\n=== 4. firing again must NOT stack a duplicate ===');
    await autoMessageSchedulerService.handleShopEvent('low_stock', { shopId: SHOP, summary: '4 items low' });
    ok((await tasksFor(ruleId!)).length === 1, 'still one task while the first is open');

    line('\n=== 5. once closed, the NEXT occurrence files again ===');
    // The half that makes this a to-do list rather than a one-shot.
    const done = await api('PATCH', `/api/shops/tasks/${first[0].id}`, { status: 'done' });
    ok(done.status === 200, `marked done via the API (${done.status})`);
    await autoMessageSchedulerService.handleShopEvent('low_stock', { shopId: SHOP, summary: '5 items low' });
    const after = await tasksFor(ruleId!);
    ok(after.length === 2, `a new task was filed after closing the last (got ${after.length})`);

    line('\n=== 6. the surface reads back what the action wrote ===');
    const listed = await api('GET', '/api/shops/tasks?status=open');
    const mine = (listed.body?.data?.tasks ?? []).filter((t: any) => t.sourceRuleId === ruleId);
    ok(listed.status === 200, `listed (${listed.status})`);
    ok(mine.length === 1, `the open task is visible to the shop (got ${mine.length})`);
    ok(typeof listed.body?.data?.openCount === 'number', 'openCount returned for the badge');

    line('\n=== 7. a task added by hand is kept apart from the machine ones ===');
    const manual = await api('POST', '/api/shops/tasks', { title: 'QA — added by hand' });
    ok(manual.status === 201, `created by hand (${manual.status})`);
    if (manual.body?.data?.id) {
      madeByHand.push(manual.body.data.id);
      ok(manual.body.data.source === 'manual', "source is 'manual', not 'workflow'");
    }

    line('\n=== 8. another shop cannot touch it ===');
    // Ownership is enforced inside the UPDATE, so a wrong shop gets 404 rather than a silent write.
    const other = jwt.sign(
      { address: '0x000000000000000000000000000000000000dead', role: 'shop', shopId: '1111' },
      process.env.JWT_SECRET as string, { expiresIn: '5m' }
    );
    const stolen = await fetch(`${API}/api/shops/tasks/${after[after.length - 1].id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${other}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' }),
    });
    ok(stolen.status === 404, `another shop got 404, not a write (${stolen.status})`);
  } finally {
    line('\ncleanup');
    if (ruleId) {
      await db.query(`DELETE FROM shop_tasks WHERE source_rule_id=$1`, [ruleId]);
      await db.query(`DELETE FROM auto_message_sends WHERE auto_message_id=$1`, [ruleId]);
      await fetch(`${API}/api/messages/auto-messages/${ruleId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
      line(`  removed rule ${ruleId} and its tasks`);
    }
    if (madeByHand.length) {
      await db.query(`DELETE FROM shop_tasks WHERE id = ANY($1::uuid[])`, [madeByHand]);
      line(`  removed ${madeByHand.length} hand-made task(s)`);
    }
    await db.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
