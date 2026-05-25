// docs/tasks/strategy/business-data-insights/qa-fixtures/qa-10-10-11-expiry-and-scope.ts
//
// QA scenarios §10.10 (expiry filter) + §10.11 (shop-scope isolation),
// run in one script because they exercise different exclusion paths
// in the same GET endpoint and don't interfere with each other.
//
// To make the result unambiguous, we insert THREE rows:
//
//   A. Normal active row for the test shop  → SHOULD appear
//   B. Already-expired row for the test shop → SHOULD NOT appear (§10.10)
//   C. Active row for ANOTHER shop           → SHOULD NOT appear (§10.11)
//
// Expected outcome in the banner: exactly one row (A). The other two
// exist in the DB but are excluded by the GET's `expires_at > NOW()`
// (B) and `WHERE shop_id = $1` (C) clauses.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-10-10-11-expiry-and-scope.ts

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
    console.log(`Connected — running §10.10 + §10.11 setup for shop='${SHOP_ID}'\n`);

    // 1. Pick a different shop_id to use for the §10.11 cross-shop
    //    insert. Foreign key requires the row to exist in `shops`,
    //    so we query for one that isn't the test shop.
    const otherShop = await client.query<{ shop_id: string }>(
      `SELECT shop_id FROM shops WHERE shop_id != $1 LIMIT 1`,
      [SHOP_ID]
    );
    if (otherShop.rowCount === 0) {
      throw new Error(
        `Couldn't find a second shop to use for §10.11. Need at least 2 rows in shops.`
      );
    }
    const OTHER_SHOP_ID = otherShop.rows[0].shop_id;
    console.log(`Step 1 — Using OTHER_SHOP_ID='${OTHER_SHOP_ID}' for §10.11.\n`);

    // 2. Dismiss leftover active rows from §10.9.
    const dismissed = await client.query(
      `UPDATE ai_insights_anomalies
       SET dismissed_at = NOW()
       WHERE shop_id = $1 AND dismissed_at IS NULL`,
      [SHOP_ID]
    );
    console.log(`Step 2 — Dismissed ${dismissed.rowCount} leftover row(s) on test shop.`);

    // 3. Insert ROW A — normal active row. Should appear in the banner.
    const a = await client.query<{ id: string }>(
      `INSERT INTO ai_insights_anomalies
         (shop_id, metric_key, current_value, prior_value,
          delta_value, delta_pct, severity, claude_phrasing,
          follow_up_question, expires_at)
       VALUES
         ($1, 'weekly_revenue', 1000, 800, 200, 25, 'low',
          'ROW A — control row, this SHOULD appear in the banner.',
          'Tell me more about row A.',
          NOW() + INTERVAL '14 days')
       RETURNING id`,
      [SHOP_ID]
    );
    console.log(`\nStep 3 — Inserted ROW A (normal, should appear)         id=${a.rows[0].id}`);

    // 4. Insert ROW B — already-expired row for §10.10. Should NOT appear.
    //    `detected_at` is intentionally recent (would otherwise rank it
    //    at the top of the LIMIT 3) so we know the EXPIRY clause is
    //    what filters it, not the cap.
    const b = await client.query<{ id: string }>(
      `INSERT INTO ai_insights_anomalies
         (shop_id, metric_key, current_value, prior_value,
          delta_value, delta_pct, severity, claude_phrasing,
          follow_up_question, expires_at, detected_at)
       VALUES
         ($1, 'weekly_no_shows', 9, 1, 8, 800, 'high',
          'ROW B — expired row, SHOULD NOT appear (§10.10).',
          'This should never reach the banner.',
          NOW() - INTERVAL '1 hour',
          NOW())
       RETURNING id`,
      [SHOP_ID]
    );
    console.log(`Step 4 — Inserted ROW B (expired,    should NOT appear)   id=${b.rows[0].id}`);

    // 5. Insert ROW C — active row for the OTHER shop. Should NOT
    //    appear when GET runs with the test shop's JWT.
    const c = await client.query<{ id: string }>(
      `INSERT INTO ai_insights_anomalies
         (shop_id, metric_key, current_value, prior_value,
          delta_value, delta_pct, severity, claude_phrasing,
          follow_up_question, expires_at)
       VALUES
         ($1, 'weekly_no_shows', 99, 1, 98, 9800, 'high',
          'ROW C — wrong-shop row, SHOULD NOT appear (§10.11).',
          'This should never reach the banner.',
          NOW() + INTERVAL '14 days')
       RETURNING id`,
      [OTHER_SHOP_ID]
    );
    console.log(`Step 5 — Inserted ROW C (other shop, should NOT appear)   id=${c.rows[0].id}`);

    // 6. Simulate the panel's GET to prove what the test shop will see.
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
    console.log(`\nStep 6 — Banner GET for shop='${SHOP_ID}' returns: ${visible.rowCount}`);
    visible.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.claude_phrasing}`);
    });

    // 7. Also show what ROW B + ROW C look like in raw DB form for
    //    forensic confirmation they exist.
    const forensic = await client.query<{
      shop_id: string;
      claude_phrasing: string;
      expires_at: Date;
      expired: boolean;
    }>(
      `SELECT shop_id, claude_phrasing, expires_at,
              (expires_at <= NOW()) AS expired
       FROM ai_insights_anomalies
       WHERE id IN ($1, $2)`,
      [b.rows[0].id, c.rows[0].id]
    );
    console.log("\nStep 7 — ROW B and ROW C exist in DB (confirmed forensically):");
    forensic.rows.forEach((row) => {
      console.log(
        `  [${row.shop_id.padEnd(12)}] expired=${row.expired ? "YES" : "NO "}  ${row.claude_phrasing}`
      );
    });

    console.log("\n✓ §10.10 + §10.11 setup complete.");
    console.log("\nClose + reopen the Insights panel.");
    console.log("Expect: ONE row visible, with text starting 'ROW A — control row'.");
    console.log("  - Absence of ROW B  → §10.10 passes (expiry filter works).");
    console.log("  - Absence of ROW C  → §10.11 passes (shop-scope works).");
    console.log("  - Both ROW B and C are still in the DB; the GET just doesn't surface them.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("§10.10 + §10.11 setup failed:", err);
  process.exit(1);
});
