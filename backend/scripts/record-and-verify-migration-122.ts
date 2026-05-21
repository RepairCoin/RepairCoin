// Record migration 122 in schema_migrations and verify the new
// ai_insights_messages table + indexes + tool_calls column.

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const EXPECTED_COLUMNS = [
  "id",
  "shop_id",
  "session_id",
  "request_payload",
  "response_payload",
  "model",
  "input_tokens",
  "output_tokens",
  "cached_input_tokens",
  "cost_usd",
  "tool_calls",
  "latency_ms",
  "error_message",
  "created_at",
];

const EXPECTED_INDEXES = [
  "idx_ai_insights_messages_shop_created",
  "idx_ai_insights_messages_session_created",
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
    // 1) Record in schema_migrations.
    await client.query(
      `INSERT INTO schema_migrations (version, name)
       VALUES (122, 'create_ai_insights_messages')
       ON CONFLICT (version) DO NOTHING`
    );

    console.log("=== schema_migrations row 122 ===");
    const rec = await client.query(
      `SELECT version, name, applied_at FROM schema_migrations WHERE version = 122`
    );
    if (rec.rows.length === 0) {
      log("schema_migrations row exists", false);
    } else {
      const r = rec.rows[0];
      log(
        `version=122, name='${r.name}'`,
        r.name === "create_ai_insights_messages",
        r.applied_at?.toISOString?.() ?? ""
      );
    }

    // 2) Table exists.
    console.log("\n=== ai_insights_messages table ===");
    const tbl = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name='ai_insights_messages'`
    );
    log("table exists", tbl.rows.length > 0);

    // 3) Columns.
    console.log("\n=== Columns ===");
    const cols = await client.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ai_insights_messages'
       ORDER BY ordinal_position`
    );
    const found = new Set(cols.rows.map((r) => r.column_name));
    for (const col of EXPECTED_COLUMNS) {
      log(col, found.has(col));
    }

    // 4) tool_calls is jsonb.
    console.log("\n=== tool_calls column shape ===");
    const tc = cols.rows.find((r) => r.column_name === "tool_calls");
    log(
      "tool_calls is jsonb",
      !!tc && tc.data_type === "jsonb",
      tc ? `data_type=${tc.data_type}` : ""
    );

    // 5) Indexes.
    console.log("\n=== Indexes ===");
    const idx = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname='public' AND tablename='ai_insights_messages'`
    );
    const idxFound = new Set(idx.rows.map((r) => r.indexname));
    for (const name of EXPECTED_INDEXES) {
      log(name, idxFound.has(name));
    }

    // 6) FK to shops.
    console.log("\n=== FK shop_id → shops ===");
    const fk = await client.query(
      `SELECT 1 FROM pg_constraint
       WHERE conrelid = 'ai_insights_messages'::regclass
         AND contype = 'f'`
    );
    log("foreign key on shop_id", fk.rows.length > 0);

    // 7) Quick smoke insert + delete to confirm INSERT shape works
    //    (catches any default / not-null issues before Phase 2 wires
    //    the InsightsAuditLogger).
    console.log("\n=== Insert / delete smoke test ===");
    let smokeOk = false;
    try {
      // Use a real shop_id so the FK passes — picking the first row.
      const shopPick = await client.query<{ shop_id: string }>(
        `SELECT shop_id FROM shops LIMIT 1`
      );
      if (shopPick.rows.length === 0) {
        log("smoke insert skipped — no shops in DB", true, "");
      } else {
        const shopId = shopPick.rows[0].shop_id;
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO ai_insights_messages
             (shop_id, session_id, request_payload, model)
           VALUES ($1, $2, $3::jsonb, $4)
           RETURNING id`,
          [shopId, "smoke-test-122", JSON.stringify({ messages: [] }), "test-model"]
        );
        const id = inserted.rows[0].id;
        await client.query(`DELETE FROM ai_insights_messages WHERE id = $1`, [id]);
        smokeOk = true;
        log("INSERT + DELETE round-trip", true, `inserted+removed id=${id}`);
      }
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
        ? "  ✓ Migration 122 applied + recorded + verified."
        : "  ✗ Issues detected — review flagged rows above."
    );
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
