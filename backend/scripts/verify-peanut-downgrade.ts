// Confirms peanut's scheduled ads-tier downgrade (Ads Pro → Ads Plus, i.e. business → growth,
// effective 2026-08-01) actually applies when the nightly SafeguardScheduler cron runs on/after 8/1.
//
//   cd backend && npx ts-node scripts/verify-peanut-downgrade.ts
//
// READ-ONLY — SELECTs only, no writes. Run it any time:
//   - BEFORE 8/1  → verdict PENDING (correct; the downgrade is scheduled, not yet due)
//   - ON/AFTER 8/1 (after the 03:00 cron) → verdict APPLIED if it worked, OVERDUE if the cron didn't fire
//
// A downgrade in this system is scheduled for the first of next month and applied by
// SubscriptionService.applyDueScheduledChanges(), invoked nightly by SafeguardScheduler (`0 3 * * *`).
// This checks the three things that must all move together: the plan's tier, its monthly fee, and the
// ad_plan_changes row's status.

import * as path from 'path'; import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { Pool } from 'pg';
const pool = new Pool({ host: process.env.DB_HOST, port: +(process.env.DB_PORT||'5432'), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });

const SHOP = 'peanut';
const EXPECT_TIER = 'growth';        // Ads Plus
const EXPECT_FEE_CENTS = 49900;      // $499/mo

(async () => {
  const now = (await pool.query(`SELECT NOW() AS n, TO_CHAR(NOW(),'YYYY-MM-DD HH24:MI') AS t`)).rows[0];

  const plan = (await pool.query(
    `SELECT flat_tier_name, flat_fee_cents, subscription_status FROM ad_billing_plans WHERE shop_id=$1`, [SHOP]
  )).rows[0];

  // The scheduled downgrade → growth we're tracking (most recent such row).
  const chg = (await pool.query(
    `SELECT status, from_tier, to_tier, TO_CHAR(effective_at,'YYYY-MM-DD') AS eff, effective_at,
            TO_CHAR(created_at,'YYYY-MM-DD') AS created
       FROM ad_plan_changes
      WHERE shop_id=$1 AND kind='downgrade' AND to_tier=$2
      ORDER BY created_at DESC LIMIT 1`, [SHOP, EXPECT_TIER]
  )).rows[0];

  const camps = (await pool.query(
    `SELECT status, COUNT(*)::int c FROM ad_campaigns WHERE shop_id=$1 GROUP BY status ORDER BY status`, [SHOP]
  )).rows;

  console.log(`=== peanut downgrade watch  (now: ${now.t} db-time) ===`);
  console.log(`plan:   tier=${plan?.flat_tier_name}  fee=$${(plan?.flat_fee_cents/100).toFixed(0)}/mo  status=${plan?.subscription_status}`);
  console.log(`change: ${chg ? `${chg.from_tier}→${chg.to_tier} [${chg.status}] scheduled ${chg.eff} (created ${chg.created})` : 'NO downgrade→growth row found'}`);
  console.log(`campaigns: ${camps.map((r:any)=>`${r.status}=${r.c}`).join(' ') || 'none'}`);

  // --- verdict ---
  const tierOk = plan?.flat_tier_name === EXPECT_TIER;
  const feeOk = Number(plan?.flat_fee_cents) === EXPECT_FEE_CENTS;
  const due = chg && new Date(chg.effective_at) <= new Date(now.n);

  let verdict: string;
  if (!chg) {
    verdict = '❓ NO SCHEDULED DOWNGRADE — it was never created, or already applied+pruned. Check the plan tier above.';
  } else if (chg.status === 'cancelled') {
    verdict = '⛔ CANCELLED — a newer tier change superseded this downgrade (§9.7). Nothing to apply.';
  } else if (chg.status === 'applied' && tierOk && feeOk) {
    verdict = '✅ APPLIED — peanut is now on Ads Plus (growth, $499). The scheduled downgrade fired correctly.';
  } else if (chg.status === 'applied' && !(tierOk && feeOk)) {
    verdict = `⚠️  ROW APPLIED BUT PLAN MISMATCH — change row says applied, but plan is ${plan?.flat_tier_name}/$${(plan?.flat_fee_cents/100).toFixed(0)}. Investigate upsertPlan.`;
  } else if (chg.status === 'scheduled' && !due) {
    verdict = `⏳ PENDING — not due yet (effective ${chg.eff}). Expected before 8/1. Re-run on/after Aug 1 (after the 03:00 cron).`;
  } else if (chg.status === 'scheduled' && due) {
    verdict = `❌ OVERDUE — due ${chg.eff} but still 'scheduled' and plan is still ${plan?.flat_tier_name}. The nightly SafeguardScheduler cron did NOT apply it — investigate the scheduler on the deployed backend.`;
  } else {
    verdict = `❓ UNEXPECTED STATE — status=${chg.status}, tier=${plan?.flat_tier_name}.`;
  }

  console.log(`\nVERDICT: ${verdict}`);
  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
