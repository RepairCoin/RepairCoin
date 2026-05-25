// docs/tasks/strategy/business-data-insights/qa-fixtures/qa-10-cleanup.ts
//
// Cleanup script for §10 QA scenarios. Hard-deletes the synthetic
// test rows inserted by qa-10-3-severity-matrix, qa-10-4-template-
// fallback, qa-10-9-max-cap, and qa-10-10-11-expiry-and-scope.
//
// Each pattern below is targeted enough to match ONLY rows I
// inserted in this QA session — real cron-generated anomalies on
// the test shop have Claude-written phrasing that wouldn't collide
// with any of these test fixtures.
//
// Hard-delete is safe because no other table FKs into
// ai_insights_anomalies (the FK goes outward, from this table to
// shops). Soft-dismiss would also work but would leave dead rows
// in the table for 14 days; hard-delete is cleaner for synthetic
// data that was never real.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-10-cleanup.ts

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../../backend/.env") });

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
    console.log("Connected — cleaning up §10 synthetic test rows.\n");

    // Pattern 1 — §10.10/11 rows: "ROW A/B/C — ..."
    const p1 = await client.query(
      `DELETE FROM ai_insights_anomalies
       WHERE claude_phrasing LIKE 'ROW A %'
          OR claude_phrasing LIKE 'ROW B %'
          OR claude_phrasing LIKE 'ROW C %'`
    );
    console.log(`Deleted ${p1.rowCount} row(s) matching '§10.10/11 ROW X — ...'`);

    // Pattern 2 — §10.9 rows: "Row #N — ..."
    const p2 = await client.query(
      `DELETE FROM ai_insights_anomalies
       WHERE claude_phrasing LIKE 'Row #_ %'`
    );
    console.log(`Deleted ${p2.rowCount} row(s) matching '§10.9 Row #N — ...'`);

    // Pattern 3 — §10.3 rows: exact phrasing match.
    const p3 = await client.query(
      `DELETE FROM ai_insights_anomalies
       WHERE claude_phrasing IN (
         'Revenue ticked up 28% week-over-week.',
         'Cancellations 2.5x''ed this week — 5 vs 2.',
         'No-shows tripled this week.'
       )`
    );
    console.log(`Deleted ${p3.rowCount} row(s) matching '§10.3 severity-matrix fixtures'`);

    // Pattern 4 — §10.4 row: NULL phrasing + distinctive composite key.
    const p4 = await client.query(
      `DELETE FROM ai_insights_anomalies
       WHERE shop_id = 'peanut'
         AND claude_phrasing IS NULL
         AND metric_key = 'weekly_revenue'
         AND current_value = 1234
         AND prior_value = 500`
    );
    console.log(`Deleted ${p4.rowCount} row(s) matching '§10.4 NULL-phrasing fixture'`);

    // Sanity check — show what active rows remain on the test shop.
    const remaining = await client.query<{
      id: string;
      shop_id: string;
      metric_key: string;
      claude_phrasing: string | null;
      dismissed_at: Date | null;
    }>(
      `SELECT id, shop_id, metric_key, claude_phrasing, dismissed_at
       FROM ai_insights_anomalies
       WHERE shop_id = 'peanut'
       ORDER BY detected_at DESC
       LIMIT 5`
    );
    console.log(`\nRemaining rows for shop='peanut' (most recent 5):`);
    if (remaining.rowCount === 0) {
      console.log("  (none)");
    } else {
      remaining.rows.forEach((r) => {
        const phrasing = r.claude_phrasing
          ? `"${r.claude_phrasing.slice(0, 60)}..."`
          : "NULL";
        const status = r.dismissed_at ? "dismissed" : "ACTIVE";
        console.log(`  [${status.padEnd(9)}] ${r.metric_key.padEnd(22)} ${phrasing}`);
      });
    }

    console.log("\n✓ Cleanup complete. Ready for §11.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
