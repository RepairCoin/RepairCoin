// Apply migration 125 (ai_insights_anomalies), record in
// schema_migrations, verify schema end-to-end against DO Postgres.
//
// Same pattern as scripts/record-and-verify-migration-122.ts.

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MIGRATION_FILE = path.resolve(
  __dirname,
  "../migrations/125_create_ai_insights_anomalies.sql"
);

const EXPECTED_COLUMNS = [
  "id",
  "shop_id",
  "metric_key",
  "detected_at",
  "current_value",
  "prior_value",
  "delta_value",
  "delta_pct",
  "z_score",
  "severity",
  "claude_phrasing",
  "follow_up_question",
  "dismissed_at",
  "expires_at",
];

const EXPECTED_INDEXES = [
  "idx_ai_insights_anomalies_shop_active",
  "idx_ai_insights_anomalies_shop_metric_detected",
];

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  let allGood = true;
  const log = (label: string, ok: boolean, detail = "") => {
    console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(60)} ${detail}`);
    if (!ok) allGood = false;
  };

  try {
    // 1) Apply migration.
    const sql = fs.readFileSync(MIGRATION_FILE, "utf-8");
    await client.query(sql);

    // 2) Record in schema_migrations.
    await client.query(
      `INSERT INTO schema_migrations (version, name)
       VALUES (125, 'create_ai_insights_anomalies')
       ON CONFLICT (version) DO NOTHING`
    );

    console.log("=== schema_migrations row 125 ===");
    const rec = await client.query(
      `SELECT version, name, applied_at FROM schema_migrations WHERE version = 125`
    );
    if (rec.rows.length === 0) {
      log("schema_migrations row exists", false);
    } else {
      const r = rec.rows[0];
      log(
        `version=125, name='${r.name}'`,
        r.name === "create_ai_insights_anomalies",
        r.applied_at?.toISOString?.() ?? ""
      );
    }

    // 3) Table exists.
    console.log("\n=== ai_insights_anomalies table ===");
    const tbl = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name='ai_insights_anomalies'`
    );
    log("table exists", tbl.rows.length > 0);

    // 4) Columns.
    console.log("\n=== Columns ===");
    const cols = await client.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ai_insights_anomalies'
       ORDER BY ordinal_position`
    );
    const found = new Set(cols.rows.map((r) => r.column_name));
    for (const col of EXPECTED_COLUMNS) log(col, found.has(col));

    // 5) Severity CHECK constraint.
    console.log("\n=== Severity CHECK constraint ===");
    const ck = await client.query(
      `SELECT 1 FROM pg_constraint
       WHERE conrelid = 'ai_insights_anomalies'::regclass
         AND contype = 'c'
         AND conname = 'ck_severity'`
    );
    log("ck_severity exists", ck.rows.length > 0);

    // 6) Indexes.
    console.log("\n=== Indexes ===");
    const idx = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname='public' AND tablename='ai_insights_anomalies'`
    );
    const idxFound = new Set(idx.rows.map((r) => r.indexname));
    for (const name of EXPECTED_INDEXES) log(name, idxFound.has(name));

    // 7) FK to shops.
    console.log("\n=== FK shop_id → shops ===");
    const fk = await client.query(
      `SELECT 1 FROM pg_constraint
       WHERE conrelid = 'ai_insights_anomalies'::regclass
         AND contype = 'f'`
    );
    log("foreign key on shop_id", fk.rows.length > 0);

    // 8) Smoke insert + delete (real shop_id).
    console.log("\n=== Insert / delete smoke test ===");
    let smokeOk = false;
    try {
      const shopPick = await client.query<{ shop_id: string }>(
        `SELECT shop_id FROM shops LIMIT 1`
      );
      if (shopPick.rows.length === 0) {
        log("smoke insert skipped — no shops in DB", true, "");
      } else {
        const shopId = shopPick.rows[0].shop_id;
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO ai_insights_anomalies
             (shop_id, metric_key, current_value, prior_value, delta_value,
              delta_pct, severity, expires_at)
           VALUES ($1, 'weekly_revenue', 2117, 1000, 1117, 111.7, 'high',
                   NOW() + INTERVAL '14 days')
           RETURNING id`,
          [shopId]
        );
        const id = inserted.rows[0].id;
        await client.query(
          `DELETE FROM ai_insights_anomalies WHERE id = $1`,
          [id]
        );
        smokeOk = true;
        log("INSERT + DELETE round-trip", true, `id=${id}`);
      }

      // 9) CHECK constraint enforces severity enum.
      let constraintWorks = false;
      try {
        await client.query(
          `INSERT INTO ai_insights_anomalies
             (shop_id, metric_key, current_value, prior_value, delta_value, severity, expires_at)
           VALUES ('this-shop-does-not-exist-zzz', 'weekly_revenue', 1, 1, 0, 'banana', NOW())`
        );
      } catch (err) {
        constraintWorks = err instanceof Error && /ck_severity|check constraint/i.test(err.message);
      }
      log("ck_severity rejects bogus severity ('banana')", constraintWorks);
    } catch (err) {
      log(
        "INSERT + DELETE round-trip",
        false,
        err instanceof Error ? err.message : String(err)
      );
    }

    console.log("\n=== Verdict ===");
    console.log(
      allGood && smokeOk
        ? "  ✓ Migration 125 applied + recorded + verified."
        : "  ✗ Issues detected — review flagged rows above."
    );
    process.exit(allGood && smokeOk ? 0 : 1);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
