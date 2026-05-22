// Apply + verify migration 126 (ai_insights_pinned_queries) on DO.
// Same pattern as scripts/record-and-verify-migration-125.ts.

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MIGRATION_FILE = path.resolve(
  __dirname,
  "../migrations/126_create_ai_insights_pinned_queries.sql"
);

const EXPECTED_COLUMNS = [
  "id",
  "shop_id",
  "question_text",
  "pinned_at",
  "last_run_at",
  "last_response_excerpt",
  "display_order",
];

const EXPECTED_INDEXES = ["idx_ai_insights_pinned_shop_order"];

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
    const sql = fs.readFileSync(MIGRATION_FILE, "utf-8");
    await client.query(sql);
    await client.query(
      `INSERT INTO schema_migrations (version, name)
       VALUES (126, 'create_ai_insights_pinned_queries')
       ON CONFLICT (version) DO NOTHING`
    );

    console.log("=== schema_migrations row 126 ===");
    const rec = await client.query(
      `SELECT version, name, applied_at FROM schema_migrations WHERE version = 126`
    );
    log(
      "row exists",
      rec.rows.length === 1 && rec.rows[0].name === "create_ai_insights_pinned_queries"
    );

    console.log("\n=== ai_insights_pinned_queries table ===");
    const tbl = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name='ai_insights_pinned_queries'`
    );
    log("table exists", tbl.rows.length > 0);

    console.log("\n=== Columns ===");
    const cols = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ai_insights_pinned_queries'
       ORDER BY ordinal_position`
    );
    const found = new Set(cols.rows.map((r) => r.column_name));
    for (const c of EXPECTED_COLUMNS) log(c, found.has(c));

    console.log("\n=== Indexes ===");
    const idx = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname='public' AND tablename='ai_insights_pinned_queries'`
    );
    const idxFound = new Set(idx.rows.map((r) => r.indexname));
    for (const i of EXPECTED_INDEXES) log(i, idxFound.has(i));

    console.log("\n=== FK shop_id → shops ===");
    const fk = await client.query(
      `SELECT 1 FROM pg_constraint
       WHERE conrelid = 'ai_insights_pinned_queries'::regclass
         AND contype = 'f'`
    );
    log("foreign key on shop_id", fk.rows.length > 0);

    console.log("\n=== Insert / delete smoke test ===");
    let smokeOk = false;
    try {
      const shopPick = await client.query<{ shop_id: string }>(
        `SELECT shop_id FROM shops LIMIT 1`
      );
      if (shopPick.rows.length === 0) {
        log("skipped — no shops", true);
      } else {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO ai_insights_pinned_queries (shop_id, question_text)
           VALUES ($1, $2) RETURNING id`,
          [shopPick.rows[0].shop_id, "How much did I earn this month?"]
        );
        const id = inserted.rows[0].id;
        await client.query(
          `DELETE FROM ai_insights_pinned_queries WHERE id = $1`,
          [id]
        );
        smokeOk = true;
        log("INSERT + DELETE round-trip", true, `id=${id}`);
      }
    } catch (err) {
      log("INSERT + DELETE round-trip", false, err instanceof Error ? err.message : String(err));
    }

    console.log("\n=== Verdict ===");
    console.log(
      allGood && smokeOk
        ? "  ✓ Migration 126 applied + recorded + verified."
        : "  ✗ Issues detected."
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
