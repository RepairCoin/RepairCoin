// docs/tasks/strategy/business-data-insights/qa-fixtures/qa-10-3-severity-matrix.ts
//
// QA scenario §10.3 — severity color matrix for the anomaly banner.
// Soft-dismisses any leftover active anomalies for the test shop,
// then inserts one row per severity (low / medium / high) with
// staggered detected_at timestamps so they sort high → medium → low
// when the panel applies ORDER BY detected_at DESC.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-10-3-severity-matrix.ts
//
// Cleanup happens via the dismiss step at the start of the next QA
// scenario's script, OR manually:
//   UPDATE ai_insights_anomalies SET dismissed_at = NOW()
//   WHERE shop_id = 'peanut' AND dismissed_at IS NULL;

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
    console.log(`Connected — running §10.3 setup for shop='${SHOP_ID}'\n`);

    // 1. Soft-dismiss every leftover active row for this shop so the
    //    test starts from a clean banner state.
    const dismissed = await client.query(
      `UPDATE ai_insights_anomalies
       SET dismissed_at = NOW()
       WHERE shop_id = $1 AND dismissed_at IS NULL`,
      [SHOP_ID]
    );
    console.log(`Step 1 — Dismissed ${dismissed.rowCount} leftover row(s).`);

    // 2. Insert one row per severity. detected_at staggering ensures
    //    high lands at the top after ORDER BY detected_at DESC.
    const inserts = [
      {
        metric: "weekly_revenue",
        current: 3200,
        prior: 2500,
        delta_value: 700,
        delta_pct: 28,
        severity: "low",
        phrasing: "Revenue ticked up 28% week-over-week.",
        followup: "Which services drove this week's revenue?",
        detected_offset_minutes: 3,
      },
      {
        metric: "weekly_cancellations",
        current: 5,
        prior: 2,
        delta_value: 3,
        delta_pct: 150,
        severity: "medium",
        phrasing: "Cancellations 2.5x'ed this week — 5 vs 2.",
        followup: "Which services had the most cancellations this week?",
        detected_offset_minutes: 2,
      },
      {
        metric: "weekly_no_shows",
        current: 8,
        prior: 2,
        delta_value: 6,
        delta_pct: 300,
        severity: "high",
        phrasing: "No-shows tripled this week.",
        followup: "Which services had the most no-shows this week?",
        detected_offset_minutes: 1,
      },
    ];

    console.log("\nStep 2 — Inserting 3 rows:");
    for (const row of inserts) {
      const result = await client.query<{ id: string; detected_at: Date }>(
        `INSERT INTO ai_insights_anomalies
           (shop_id, metric_key, current_value, prior_value,
            delta_value, delta_pct, severity, claude_phrasing,
            follow_up_question, expires_at, detected_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9,
            NOW() + INTERVAL '14 days',
            NOW() - ($10 || ' minutes')::interval)
         RETURNING id, detected_at`,
        [
          SHOP_ID,
          row.metric,
          row.current,
          row.prior,
          row.delta_value,
          row.delta_pct,
          row.severity,
          row.phrasing,
          row.followup,
          row.detected_offset_minutes,
        ]
      );
      const r = result.rows[0];
      console.log(
        `  [${row.severity.padEnd(6)}] ${row.metric.padEnd(22)} id=${r.id}`
      );
    }

    // 3. Read-back to confirm what the panel will GET.
    const active = await client.query<{
      id: string;
      metric_key: string;
      severity: string;
      detected_at: Date;
    }>(
      `SELECT id, metric_key, severity, detected_at
       FROM ai_insights_anomalies
       WHERE shop_id = $1
         AND dismissed_at IS NULL
         AND expires_at > NOW()
       ORDER BY detected_at DESC
       LIMIT 3`,
      [SHOP_ID]
    );
    console.log(
      "\nStep 3 — Active rows the banner GET will return (top 3, newest first):"
    );
    active.rows.forEach((r, i) => {
      console.log(
        `  ${i + 1}. [${r.severity.padEnd(6)}] ${r.metric_key.padEnd(22)} ${r.detected_at.toISOString()}`
      );
    });

    console.log("\n✓ §10.3 setup complete. Close + reopen the Insights panel.");
    console.log("  Expect top→bottom: high (red) → medium (orange) → low (amber).");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("§10.3 setup failed:", err);
  process.exit(1);
});
