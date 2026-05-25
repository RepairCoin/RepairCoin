// docs/tasks/strategy/business-data-insights/qa-fixtures/qa-10-4-template-fallback.ts
//
// QA scenario §10.4 — template fallback when claude_phrasing IS NULL.
// Cleans up §10.3's rows, then inserts one anomaly with both
// claude_phrasing AND follow_up_question set to NULL. The banner
// has to render template-formatted body text (no Claude prose) AND
// hide the "Tell me more" chip (no followup question to submit).
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-10-4-template-fallback.ts

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
    console.log(`Connected — running §10.4 setup for shop='${SHOP_ID}'\n`);

    // 1. Dismiss leftover rows so only the §10.4 row is visible.
    const dismissed = await client.query(
      `UPDATE ai_insights_anomalies
       SET dismissed_at = NOW()
       WHERE shop_id = $1 AND dismissed_at IS NULL`,
      [SHOP_ID]
    );
    console.log(`Step 1 — Dismissed ${dismissed.rowCount} leftover row(s).`);

    // 2. Insert one row with NULL phrasing AND NULL follow_up.
    //    weekly_revenue chosen so we can verify currency formatting
    //    in the template body text.
    const inserted = await client.query<{
      id: string;
      claude_phrasing: string | null;
      follow_up_question: string | null;
    }>(
      `INSERT INTO ai_insights_anomalies
         (shop_id, metric_key, current_value, prior_value,
          delta_value, delta_pct, severity,
          claude_phrasing, follow_up_question, expires_at)
       VALUES
         ($1, 'weekly_revenue', 1234, 500, 734, 147, 'medium',
          NULL, NULL,
          NOW() + INTERVAL '14 days')
       RETURNING id, claude_phrasing, follow_up_question`,
      [SHOP_ID]
    );
    const r = inserted.rows[0];
    console.log("\nStep 2 — Inserted 1 row with NULL phrasing + NULL followup:");
    console.log(`  id=${r.id}`);
    console.log(`  claude_phrasing = ${r.claude_phrasing}`);
    console.log(`  follow_up_question = ${r.follow_up_question}`);

    // 3. Read-back to confirm what the banner GET returns.
    const active = await client.query<{
      id: string;
      metric_key: string;
      severity: string;
      claude_phrasing: string | null;
      follow_up_question: string | null;
      current_value: string;
      prior_value: string;
      delta_pct: string | null;
    }>(
      `SELECT id, metric_key, severity, claude_phrasing,
              follow_up_question, current_value, prior_value, delta_pct
       FROM ai_insights_anomalies
       WHERE shop_id = $1
         AND dismissed_at IS NULL
         AND expires_at > NOW()
       ORDER BY detected_at DESC`,
      [SHOP_ID]
    );
    console.log(`\nStep 3 — Active rows the banner will receive: ${active.rowCount}`);
    active.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. [${row.severity}] ${row.metric_key}`);
      console.log(`      current=${row.current_value}, prior=${row.prior_value}, delta_pct=${row.delta_pct}`);
      console.log(`      claude_phrasing=${row.claude_phrasing === null ? "NULL ← fallback path" : "<set>"}`);
      console.log(`      follow_up_question=${row.follow_up_question === null ? "NULL ← chip hidden" : "<set>"}`);
    });

    console.log("\n✓ §10.4 setup complete. Close + reopen the Insights panel.");
    console.log("  Expect ONE row with:");
    console.log("    - medium-severity (orange) tone");
    console.log('    - Body text: "Your weekly revenue changed from $500 to $1,234 this week (+147%)."');
    console.log("    - NO 'Tell me more' chip (only timestamp + dismiss X)");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("§10.4 setup failed:", err);
  process.exit(1);
});
