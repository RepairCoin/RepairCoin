import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  try {
    // Check 1: ai_custom_instructions column should be GONE.
    const colCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'shop_services'
        AND column_name = 'ai_custom_instructions'
    `);
    console.log("=== Check 1: ai_custom_instructions column dropped ===");
    if (colCheck.rows.length === 0) {
      console.log("  ✅ column NOT present (migration 113 ran).");
    } else {
      console.log("  ❌ column STILL PRESENT — migration didn't run.");
    }

    // Check 2: service_ai_faq_entries table should EXIST with expected columns.
    console.log("\n=== Check 2: service_ai_faq_entries table created ===");
    const tableCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'service_ai_faq_entries'
      ORDER BY ordinal_position
    `);
    if (tableCheck.rows.length === 0) {
      console.log("  ❌ table NOT present — migration didn't run.");
    } else {
      console.log("  ✅ table present with columns:");
      for (const r of tableCheck.rows) {
        console.log(`     - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`);
      }
    }

    // Check 3: index present.
    console.log("\n=== Check 3: composite index exists ===");
    const idxCheck = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'service_ai_faq_entries'
        AND indexname = 'idx_service_ai_faq_entries_service_id_order'
    `);
    if (idxCheck.rows.length === 0) {
      console.log("  ❌ index NOT present.");
    } else {
      console.log("  ✅ index present.");
      console.log(`     ${idxCheck.rows[0].indexdef}`);
    }

    // Check 4: AI fields still intact on shop_services.
    console.log("\n=== Check 4: other ai_* columns still on shop_services ===");
    const aiColsCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'shop_services'
        AND column_name LIKE 'ai_%'
      ORDER BY column_name
    `);
    console.log(
      "  Present:",
      aiColsCheck.rows.map((r) => r.column_name).join(", ") || "<none>"
    );

    // Check 5: row count (should be 0 — nothing's populated yet).
    const cnt = await client.query(`SELECT count(*)::int as c FROM service_ai_faq_entries`);
    console.log("\n=== Check 5: row count ===");
    console.log(`  ${cnt.rows[0].c} entries`);

    // Check 6: most recent AI call still working (sanity that backend deploy didn't break anything).
    console.log("\n=== Check 6: most recent ai_agent_messages call ===");
    const recent = await client.query(`
      SELECT shop_id,
             (request_payload->>'systemPromptLength')::int as sys_len,
             response_payload->>'stopReason' as stop_reason,
             jsonb_array_length(COALESCE(tool_calls, '[]'::jsonb)) as tool_calls,
             created_at
      FROM ai_agent_messages
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (recent.rows.length > 0) {
      const r = recent.rows[0];
      console.log(
        `  shop=${r.shop_id} sys_len=${r.sys_len} stop=${r.stop_reason} tool_calls=${r.tool_calls} at=${r.created_at.toISOString()}`
      );
    } else {
      console.log("  (no calls in the audit log)");
    }
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
