// Verifies the AI spend-cap month-rollover semantics in SpendCapEnforcer against the REAL schema.
//
//   npx ts-node scripts/verify-ai-spend-rollover.ts     # exit 0 = pass, 1 = fail
//
// Safe to run against any environment: every write happens inside a transaction that is ALWAYS
// rolled back, so no shop's counter is touched.
//
// WHEN TO RUN. Two moments matter:
//   1. After any change to SpendCapEnforcer's rollover or recordSpend SQL.
//   2. Just after a calendar month turns over. The truncated month stamp is only WRITTEN when a shop
//      crosses a month boundary, so between rollovers the fix is unobservable in live data — this
//      script is the only way to exercise it on demand. After a real rollover, also confirm live
//      stamps read exactly 'YYYY-MM-01 00:00:00' with no mid-month clusters:
//        SELECT TO_CHAR(current_month_started_at,'YYYY-MM-DD HH24:MI:SS'), COUNT(*)
//          FROM ai_shop_settings GROUP BY 1 ORDER BY 2 DESC;
//
// Background: the stamp used to be NOW(), which recorded when a request first NOTICED the month had
// turned rather than when it began — so a background sweep stamped whole batches of shops with one
// mid-month second and a genuine anomaly was indistinguishable from noise. Case 6 guards the
// migration risk that mattered on deploy: a legacy mid-month stamp must NOT trigger a rollover, or
// live spend would be wiped.

import * as path from 'path'; import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { Pool } from 'pg';
const pool = new Pool({ host: process.env.DB_HOST, port: +(process.env.DB_PORT||'5432'), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });

// The exact statements SpendCapEnforcer now issues.
//
// Timestamps are read back with TO_CHAR, deliberately. `current_month_started_at` is TIMESTAMP
// WITHOUT TIME ZONE and the staging session runs at +08, so pulling the value through a JS Date
// shifts it by 8h and an assertion written in UTC would fail against correct data. Comparing the
// database's own rendering keeps both sides on one clock.
const RECORD_SPEND_SQL = `
  UPDATE ai_shop_settings
     SET current_month_spend_usd =
           CASE WHEN DATE_TRUNC('month', current_month_started_at) < DATE_TRUNC('month', NOW())
                THEN $1::numeric
                ELSE current_month_spend_usd + $1::numeric END,
         current_month_started_at =
           CASE WHEN DATE_TRUNC('month', current_month_started_at) < DATE_TRUNC('month', NOW())
                THEN DATE_TRUNC('month', NOW())
                ELSE current_month_started_at END,
         updated_at = NOW()
   WHERE shop_id = $2
   RETURNING current_month_spend_usd,
             TO_CHAR(current_month_started_at, 'YYYY-MM-DD HH24:MI:SS') AS stamp_text`;

const ROLLOVER_SQL = `
  UPDATE ai_shop_settings
     SET current_month_spend_usd = 0,
         current_month_started_at = DATE_TRUNC('month', NOW()),
         updated_at = NOW()
   WHERE shop_id = $1
     AND DATE_TRUNC('month', current_month_started_at) < DATE_TRUNC('month', NOW())
   RETURNING current_month_spend_usd,
             TO_CHAR(current_month_started_at, 'YYYY-MM-DD HH24:MI:SS') AS stamp_text`;

// Everything runs inside a transaction that is ALWAYS rolled back — this exercises the real schema
// and the real planner without mutating staging.
(async () => {
  const fails: string[] = [];
  // Expected stamp, computed BY THE DATABASE, for the reason in the comment above.
  const expectedStamp: string = (await pool.query(
    `SELECT TO_CHAR(DATE_TRUNC('month', NOW()), 'YYYY-MM-DD HH24:MI:SS') AS s`)).rows[0].s;
  const isMonthStart = (s: string) => /^\d{4}-\d{2}-01 00:00:00$/.test(s);

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const shop = (await c.query(`SELECT shop_id FROM ai_shop_settings LIMIT 1`)).rows[0].shop_id;
    console.log(`(sandbox shop: ${shop} — all writes rolled back)`);
    console.log(`(db month start = ${expectedStamp})\n`);

    // --- Case 1: STALE month + existing spend. recordSpend must RESET, not add. ---
    await c.query(
      `UPDATE ai_shop_settings SET current_month_spend_usd = 9.99,
              current_month_started_at = DATE_TRUNC('month', NOW()) - INTERVAL '1 month' + INTERVAL '13 days'
        WHERE shop_id = $1`, [shop]);
    const r1 = (await c.query(RECORD_SPEND_SQL, [0.25, shop])).rows[0];
    const spend1 = Number(r1.current_month_spend_usd);
    console.log(`1. stale month, prior spend $9.99, record $0.25`);
    console.log(`   -> spend $${spend1.toFixed(2)} (want 0.25, NOT 10.24)   stamp ${r1.stamp_text}`);
    if (Math.abs(spend1 - 0.25) > 1e-9) fails.push(`stale-month recordSpend gave ${spend1}, want 0.25 (it added instead of resetting)`);
    if (!isMonthStart(r1.stamp_text)) fails.push(`stale-month stamp ${r1.stamp_text} is not the first instant of a month`);

    // --- Case 2: CURRENT month. recordSpend must ADD. ---
    await c.query(
      `UPDATE ai_shop_settings SET current_month_spend_usd = 2.00,
              current_month_started_at = DATE_TRUNC('month', NOW()) WHERE shop_id = $1`, [shop]);
    const r2 = (await c.query(RECORD_SPEND_SQL, [0.5, shop])).rows[0];
    const spend2 = Number(r2.current_month_spend_usd);
    console.log(`2. current month, prior spend $2.00, record $0.50`);
    console.log(`   -> spend $${spend2.toFixed(2)} (want 2.50)`);
    if (Math.abs(spend2 - 2.5) > 1e-9) fails.push(`current-month recordSpend gave ${spend2}, want 2.50`);

    // --- Case 3: the rollover stamps the START of the month, not "now". ---
    await c.query(
      `UPDATE ai_shop_settings SET current_month_spend_usd = 7.77,
              current_month_started_at = DATE_TRUNC('month', NOW()) - INTERVAL '20 days' WHERE shop_id = $1`, [shop]);
    const r3 = (await c.query(ROLLOVER_SQL, [shop])).rows[0];
    console.log(`3. rollover of a previous-month row`);
    console.log(`   -> spend $${Number(r3.current_month_spend_usd).toFixed(2)} (want 0.00)   stamp ${r3.stamp_text} (want ${expectedStamp})`);
    if (Number(r3.current_month_spend_usd) !== 0) fails.push('rollover did not zero the counter');
    if (r3.stamp_text !== expectedStamp) fails.push(`rollover stamp ${r3.stamp_text} != ${expectedStamp}`);

    // --- Case 4: rollover is a no-op inside the same month (must not wipe live spend). ---
    await c.query(
      `UPDATE ai_shop_settings SET current_month_spend_usd = 4.44,
              current_month_started_at = DATE_TRUNC('month', NOW()) WHERE shop_id = $1`, [shop]);
    const r4 = await c.query(ROLLOVER_SQL, [shop]);
    const after4 = Number((await c.query(`SELECT current_month_spend_usd FROM ai_shop_settings WHERE shop_id=$1`, [shop])).rows[0].current_month_spend_usd);
    console.log(`4. rollover within the current month -> ${r4.rowCount} rows touched (want 0), spend still $${after4.toFixed(2)} (want 4.44)`);
    if (r4.rowCount !== 0) fails.push('rollover fired inside the current month — it would wipe live spend');
    if (Math.abs(after4 - 4.44) > 1e-9) fails.push(`in-month spend changed to ${after4}`);

    // --- Case 5: idempotence — a second rollover must be a no-op. ---
    await c.query(
      `UPDATE ai_shop_settings SET current_month_spend_usd = 3.00,
              current_month_started_at = DATE_TRUNC('month', NOW()) - INTERVAL '2 months' WHERE shop_id = $1`, [shop]);
    const a = (await c.query(ROLLOVER_SQL, [shop])).rows[0];
    const b = await c.query(ROLLOVER_SQL, [shop]);
    console.log(`5. idempotence: first run -> $${Number(a.current_month_spend_usd).toFixed(2)}, second run touched ${b.rowCount} rows (want 0)`);
    if (b.rowCount !== 0) fails.push('rollover is not idempotent');

    // --- Case 6: a stamp written by the OLD code (mid-month NOW()) must not trigger a spurious
    // rollover — the fix must not wipe live spend on shops carrying legacy stamps. ---
    await c.query(
      `UPDATE ai_shop_settings SET current_month_spend_usd = 5.55,
              current_month_started_at = DATE_TRUNC('month', NOW()) + INTERVAL '13 days 7 hours'
        WHERE shop_id = $1`, [shop]);
    const r6 = await c.query(ROLLOVER_SQL, [shop]);
    const after6 = Number((await c.query(`SELECT current_month_spend_usd FROM ai_shop_settings WHERE shop_id=$1`, [shop])).rows[0].current_month_spend_usd);
    console.log(`6. legacy mid-month stamp -> ${r6.rowCount} rows touched (want 0), spend still $${after6.toFixed(2)} (want 5.55)`);
    if (r6.rowCount !== 0 || Math.abs(after6 - 5.55) > 1e-9) fails.push('a legacy mid-month stamp triggered a rollover — existing spend would be wiped on deploy');
  } finally {
    await c.query('ROLLBACK');
    c.release();
  }

  console.log(fails.length ? `\nFAILED:\n - ${fails.join('\n - ')}` : '\nALL ROLLOVER CHECKS PASSED (transaction rolled back — staging untouched)');
  await pool.end();
  process.exit(fails.length ? 1 : 0);
})().catch(e=>{console.error(e.message);process.exit(1)});
