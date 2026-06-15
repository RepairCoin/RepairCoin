// scripts/qa-ads-enrollment.ts
//
// End-to-end QA for the shop "Request ads" opt-in cycle. Drives the REAL backend
// repositories (the same code the HTTP controllers call) through the whole flow and
// asserts every transition, so you can confirm it works without juggling two browser
// logins. Then it leaves the target shop with a PENDING request, so you can hop into
// the admin UI and click Approve to see the cycle finish on-screen.
//
//   Run:    npx ts-node scripts/qa-ads-enrollment.ts [shopIdOrName]   (default: peanut)
//   Clean:  npx ts-node scripts/qa-ads-enrollment.ts --clean [shop]   (removes the QA request)
//
// DB = the shared DO staging DB (same .env). The QA request is on one shop and is
// fully removable with --clean.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const args = process.argv.slice(2);
const clean = args.includes('--clean');
const SHOP = (args.find((a) => !a.startsWith('--')) || 'peanut').trim();

const raw = new Pool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
});

let pass = 0, fail = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  → ' + detail : ''}`);
  cond ? pass++ : fail++;
};

(async () => {
  // Repositories are imported after dotenv so the shared pool sees the env.
  const { EnrollmentRepository } = await import('../src/domains/AdsDomain/repositories/EnrollmentRepository');
  const { BillingPlanRepository } = await import('../src/domains/AdsDomain/repositories/BillingPlanRepository');
  const enroll = new EnrollmentRepository();
  const plans = new BillingPlanRepository();

  // Resolve the shop id (accept id or name).
  const shopRow = await raw.query(
    `SELECT shop_id FROM shops WHERE shop_id = $1 OR name ILIKE $2 ORDER BY shop_id = $1 DESC LIMIT 1`,
    [SHOP, `%${SHOP}%`]
  );
  if (shopRow.rows.length === 0) { console.error(`No shop matched "${SHOP}".`); process.exit(1); }
  const shopId: string = shopRow.rows[0].shop_id;

  if (clean) {
    const r = await raw.query(`DELETE FROM ad_enrollment_requests WHERE shop_id = $1`, [shopId]);
    console.log(`Removed ${r.rowCount} QA enrollment request(s) for ${shopId}.`);
    await raw.end(); return;
  }

  console.log(`\n=== QA: Shop "Request Ads" full cycle — shop: ${shopId} ===\n`);
  // Clean slate.
  await raw.query(`DELETE FROM ad_enrollment_requests WHERE shop_id = $1`, [shopId]);

  // ---- Part A: request → admin sees it → approve → plan set → re-request no-op ----
  console.log('Part A — approval path');
  const a1 = await enroll.request(shopId, 'b', 'Please run ads for my shop — focused on screen repairs.');
  ok('1. Shop submits request (Plan B)', a1.status === 'pending' && a1.requestedPlan === 'b', `status=${a1.status}`);

  const pendingList = await enroll.list('pending');
  ok('2. Admin sees it in the pending list', pendingList.some((e) => e.shopId === shopId), `${pendingList.length} pending`);

  // Mirror EnrollmentController.decideEnrollment (approve): decide + set billing plan.
  const a3 = await enroll.decide(shopId, 'approved', 'qa-admin');
  await plans.upsertPlan(shopId, { planType: a1.requestedPlan, active: true });
  ok('3. Admin approves', a3?.status === 'approved', `status=${a3?.status}`);

  const plan = await plans.getPlan(shopId);
  ok('4. Shop billing plan set to the requested plan', plan?.planType === 'b', `plan_type=${plan?.planType}`);

  const a5 = await enroll.request(shopId, 'c', 'changed my mind to C');
  ok('5. Re-request after approval is a no-op (stays approved)', a5.status === 'approved', `status=${a5.status}`);

  // ---- Part B: decline path → re-request reopens ----
  console.log('\nPart B — decline path');
  await raw.query(`DELETE FROM ad_enrollment_requests WHERE shop_id = $1`, [shopId]); // reset
  const b1 = await enroll.request(shopId, 'a', 'Dashboard-only please.');
  ok('6. Shop submits a new request (Plan A)', b1.status === 'pending' && b1.requestedPlan === 'a', `status=${b1.status}`);

  const b2 = await enroll.decide(shopId, 'declined', 'qa-admin', 'Outside our service area for now.');
  ok('7. Admin declines with a reason', b2?.status === 'declined' && !!b2?.declineReason, `reason="${b2?.declineReason}"`);

  const b3 = await enroll.request(shopId, 'b', 'Trying again with the managed plan.');
  ok('8. Re-request reopens a declined request (→ pending)', b3.status === 'pending', `status=${b3.status}`);

  // Leave the shop with a fresh PENDING request for the browser walkthrough.
  console.log(`\n──────────────────────────────────────────────`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? `, ${fail} FAILED` : ' ✅'}`);
  console.log(`\nLeft ${shopId} with a PENDING request so you can finish the cycle on-screen:`);
  console.log(`  • Admin → Ads tab → "Ad program requests" → Approve ${shopId}`);
  console.log(`  • Then log in as ${shopId} → Your Ads → card shows "You're enrolled".`);
  console.log(`Remove the QA request when done:  npx ts-node scripts/qa-ads-enrollment.ts --clean ${shopId}\n`);

  await raw.end();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('QA failed:', e.message); process.exit(1); });
