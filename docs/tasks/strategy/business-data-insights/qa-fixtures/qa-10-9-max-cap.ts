// docs/tasks/strategy/business-data-insights/qa-fixtures/qa-10-9-max-cap.ts
//
// QA scenario §10.9 — max-3 anomaly cap. Inserts FIVE active rows
// with explicit detected_at staggering, then verifies that the
// banner GET only returns the top 3 (ORDER BY detected_at DESC
// LIMIT 3).
//
// To keep the test obvious, each row carries a numbered phrasing
// ("Row #N ...") so a glance at the panel tells you which rows are
// showing vs hidden. Newest row (#1) should appear at the top of
// the banner; oldest row (#5) should be invisible until earlier
// rows are dismissed AND the panel is reopened.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-10-9-max-cap.ts

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../../backend/.env") });

const SHOP_ID = "peanut";

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();
  try {
    console.log(`Connected — running §10.9 setup for shop='${SHOP_ID}'\n`);

    // 1. Dismiss leftovers from §10.4.
    const dismissed = await client.query(
      `UPDATE ai_insights_anomalies
       SET dismissed_at = NOW()
       WHERE shop_id = $1 AND dismissed_at IS NULL`,
      [SHOP_ID]
    );
    console.log(`Step 1 — Dismissed ${dismissed.rowCount} leftover row(s).`);

    // 2. Insert 5 rows. detected_at offsets ensure deterministic
    //    sort order under the GET's ORDER BY detected_at DESC.
    //    Row #1 = newest (1 minute ago); Row #5 = oldest (5 min ago).
    //    Body text starts with "Row #N" so the panel makes the cap
    //    behavior visible at a glance.
    const rows = [
      { n: 1, offset_min: 1, phrasing: "Row #1 — newest, should appear at TOP of banner." },
      { n: 2, offset_min: 2, phrasing: "Row #2 — should appear in MIDDLE of banner." },
      { n: 3, offset_min: 3, phrasing: "Row #3 — should appear at BOTTOM of banner." },
      { n: 4, offset_min: 4, phrasing: "Row #4 — should be HIDDEN behind the max-3 cap." },
      { n: 5, offset_min: 5, phrasing: "Row #5 — oldest, should be HIDDEN behind the max-3 cap." },
    ];

    console.log("\nStep 2 — Inserting 5 rows (all medium severity):");
    for (const r of rows) {
      await client.query(
        `INSERT INTO ai_insights_anomalies
           (shop_id, metric_key, current_value, prior_value,
            delta_value, delta_pct, severity, claude_phrasing,
            follow_up_question, expires_at, detected_at)
         VALUES
           ($1, 'weekly_cancellations', 5, 2, 3, 150, 'medium', $2,
            'Tell me more about row ' || $3,
            NOW() + INTERVAL '14 days',
            NOW() - ($4 || ' minutes')::interval)`,
        [SHOP_ID, r.phrasing, r.n, r.offset_min]
      );
      console.log(`  Row #${r.n}  detected_at = NOW() - ${r.offset_min}m`);
    }

    // 3. Read-back ALL active rows to prove 5 exist server-side.
    const all = await client.query<{
      claude_phrasing: string;
      detected_at: Date;
    }>(
      `SELECT claude_phrasing, detected_at
       FROM ai_insights_anomalies
       WHERE shop_id = $1
         AND dismissed_at IS NULL
         AND expires_at > NOW()
       ORDER BY detected_at DESC`,
      [SHOP_ID]
    );
    console.log(`\nStep 3 — All active rows in DB: ${all.rowCount}`);
    all.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.claude_phrasing}`);
    });

    // 4. Re-run the EXACT query the banner GET uses (LIMIT 3) to
    //    prove which rows the panel will receive on next mount.
    const visible = await client.query<{
      claude_phrasing: string;
    }>(
      `SELECT claude_phrasing
       FROM ai_insights_anomalies
       WHERE shop_id = $1
         AND dismissed_at IS NULL
         AND expires_at > NOW()
       ORDER BY detected_at DESC
       LIMIT 3`,
      [SHOP_ID]
    );
    console.log(`\nStep 4 — Banner GET will return (LIMIT 3):`);
    visible.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.claude_phrasing}`);
    });

    console.log("\n✓ §10.9 setup complete.");
    console.log("\nVerify the cap behavior in 3 stages:");
    console.log("  (a) Close + reopen panel → expect rows #1, #2, #3 visible;");
    console.log("      rows #4, #5 NOT visible.");
    console.log("  (b) Dismiss the #3 row by clicking its X. Without closing,");
    console.log("      expect the banner to show only #1 + #2. Row #4 should");
    console.log("      NOT auto-promote into view — the panel doesn't refetch.");
    console.log("  (c) Close + reopen again → expect rows #1, #2, #4 visible.");
    console.log("      The refetch picks up row #4 to fill the slot.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("§10.9 setup failed:", err);
  process.exit(1);
});
