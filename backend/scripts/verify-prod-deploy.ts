/**
 * Read-only post-deploy verification for the prod database.
 *
 * Confirms migrations 107 + 108 landed and AI columns + import_jobs table
 * are in the expected state. Read-only — no INSERTs, UPDATEs, or DELETEs.
 *
 * Usage:
 *   npx ts-node scripts/verify-prod-deploy.ts <path-to-env-file>
 *
 * Example (current operator workflow):
 *   npx ts-node scripts/verify-prod-deploy.ts "C:/dev/external_inventory/prod_evn.txt"
 *
 * The env file is read directly; credentials never enter logs or memory beyond
 * the single Pool connection. The script does NOT write the credentials anywhere.
 *
 * Safety: read-only by design. Running against the wrong env file at worst
 * shows "table doesn't exist" — no destructive risk.
 */

import * as fs from "fs";
import * as readline from "readline";
import { Pool } from "pg";

const envPath = process.argv[2];
if (!envPath) {
  console.error("Usage: npx ts-node scripts/verify-prod-deploy.ts <path-to-env-file>");
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  console.error(`Env file not found: ${envPath}`);
  process.exit(1);
}

// Parse the env file inline — single-line KEY=VALUE pairs, ignore comments and blanks
function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = parseEnvFile(envPath);

const required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
for (const key of required) {
  if (!env[key]) {
    console.error(`Missing ${key} in ${envPath}`);
    process.exit(1);
  }
}

// Confirm we're hitting prod (sanity check — surface visibility of the host
// without echoing the password)
const hostHint = env.DB_HOST.split(".")[0]; // first label only
console.log(`Target DB host: ${env.DB_HOST.split(".").slice(0, 2).join(".")}...  (host label: ${hostHint})`);
console.log(`Target DB name: ${env.DB_NAME}`);
console.log(`NODE_ENV from env file: ${env.NODE_ENV ?? "(not set)"}`);

if (!env.DB_HOST.toLowerCase().includes("prod")) {
  console.log("\nWARNING: DB_HOST does not contain 'prod' — is this the right env file?");
  // Continue anyway — read-only
}

console.log();

const pool = new Pool({
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT, 10),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

(async () => {
  const c = await pool.connect();
  try {
    console.log("=== 1. schema_migrations: 107 + 108 applied? ===");
    const migrationCols = await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'schema_migrations'`
    );
    const colNames = migrationCols.rows.map((r) => r.column_name);
    const hasName = colNames.includes("name");
    const hasAppliedAt = colNames.includes("applied_at");
    const select = `version${hasName ? ", name" : ""}${hasAppliedAt ? ", applied_at" : ""}`;
    const r1 = await c.query(
      `SELECT ${select} FROM schema_migrations WHERE version IN ('107','108',107,108) ORDER BY version`
    );
    if (r1.rows.length === 0) {
      console.log("  NEITHER 107 NOR 108 RECORDED. Migration runner did not apply them.");
      console.log("  Likely cause: same drift we saw on staging. Manual application needed.");
    } else {
      for (const row of r1.rows) {
        console.log(`  version=${row.version}  name=${row.name ?? "(no name col)"}  applied_at=${row.applied_at ?? "(no applied_at col)"}`);
      }
      const versions = r1.rows.map((r) => Number(r.version));
      if (!versions.includes(107)) console.log("  WARNING: 107 missing");
      if (!versions.includes(108)) console.log("  WARNING: 108 missing");
    }

    console.log("\n=== 2. shop_services: 5 AI columns present with defaults? ===");
    const r2 = await c.query(
      `SELECT column_name, data_type, column_default, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'shop_services'
         AND column_name IN ('ai_sales_enabled', 'ai_tone', 'ai_suggest_upsells', 'ai_booking_assistance', 'ai_custom_instructions')
       ORDER BY column_name`
    );
    if (r2.rows.length === 0) {
      console.log("  ZERO AI columns found. Migration 108 did NOT apply.");
    } else {
      for (const row of r2.rows) {
        console.log(`  ${row.column_name.padEnd(28)} ${row.data_type.padEnd(20)} default=${(row.column_default ?? "(none)").padEnd(20)} nullable=${row.is_nullable}`);
      }
      const expected = ["ai_booking_assistance", "ai_custom_instructions", "ai_sales_enabled", "ai_suggest_upsells", "ai_tone"];
      const got = r2.rows.map((r) => r.column_name).sort();
      for (const e of expected) {
        if (!got.includes(e)) console.log(`  WARNING: missing column ${e}`);
      }
    }

    console.log("\n=== 3. import_jobs table exists? (migration 107) ===");
    const r3 = await c.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'import_jobs') AS exists`
    );
    if (r3.rows[0]?.exists) {
      const r3b = await c.query(`SELECT COUNT(*)::int AS row_count FROM import_jobs`);
      console.log(`  import_jobs table EXISTS. Row count: ${r3b.rows[0].row_count}`);
    } else {
      console.log(`  import_jobs table DOES NOT EXIST. Migration 107 did not apply.`);
    }

    console.log("\n=== 4. shop_services AI defaults backfilled correctly? ===");
    const r4 = await c.query(
      `SELECT
         COUNT(*)::int AS total_services,
         COUNT(*) FILTER (WHERE ai_sales_enabled IS NULL)::int AS nulls,
         COUNT(*) FILTER (WHERE ai_sales_enabled = false)::int AS opted_out,
         COUNT(*) FILTER (WHERE ai_sales_enabled = true)::int AS opted_in
       FROM shop_services`
    ).catch((err: any) => {
      console.log(`  Could not query: ${err.message}`);
      return null;
    });
    if (r4 && r4.rows[0]) {
      const row = r4.rows[0];
      console.log(`  Total services:       ${row.total_services}`);
      console.log(`  ai_sales_enabled NULL: ${row.nulls}    ← should be 0 if defaults backfilled`);
      console.log(`  Opted out (false):     ${row.opted_out}`);
      console.log(`  Opted in (true):       ${row.opted_in}`);
    }

    console.log("\n=== Summary ===");
    const ok107 = r3.rows[0]?.exists === true;
    const ok108 = r2.rows.length === 5;
    console.log(`  Migration 107 (import_jobs):           ${ok107 ? "PASS" : "FAIL"}`);
    console.log(`  Migration 108 (shop_services AI cols): ${ok108 ? "PASS" : "FAIL"}`);
    if (ok107 && ok108) {
      console.log(`  Both migrations landed cleanly.`);
    } else {
      console.log(`  At least one migration did not apply. Manual application may be needed.`);
    }
  } finally {
    c.release();
    await pool.end();
  }
})();
