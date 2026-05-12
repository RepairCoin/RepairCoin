/**
 * Manually apply migration 113 + record it in schema_migrations so the
 * tracked-applied list stays in sync.
 *
 * Idempotent: the SQL uses DROP COLUMN IF EXISTS + CREATE TABLE IF NOT
 * EXISTS + CREATE INDEX IF NOT EXISTS, and the schema_migrations INSERT
 * uses ON CONFLICT DO NOTHING. Safe to re-run.
 *
 * Run: npx ts-node scripts/apply-migration-113-manually.ts
 *
 * Why this script exists: DO App Platform deploy de650c3 didn't trigger
 * prestart's `npm run db:migrate`, leaving migration 113 unapplied even
 * though the code that depends on it shipped. Investigate the prestart
 * issue separately; this unblocks the FAQ feature now.
 */

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MIGRATION_VERSION = 113;
const MIGRATION_NAME = "drop_ai_custom_instructions_and_add_faq_table";
const SQL_FILE = path.resolve(
  __dirname,
  "..",
  "migrations",
  "113_drop_ai_custom_instructions_and_add_faq_table.sql"
);

async function main() {
  if (!fs.existsSync(SQL_FILE)) {
    console.error(`Migration SQL file not found: ${SQL_FILE}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(SQL_FILE, "utf8");

  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    // Pre-state snapshot
    const before = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shop_services' AND column_name = 'ai_custom_instructions'
      ) AS col_exists, EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'service_ai_faq_entries'
      ) AS faq_table_exists
    `);
    console.log("BEFORE:", before.rows[0]);

    await client.query("BEGIN");
    console.log("Running migration SQL...");
    await client.query(sql);
    console.log("Recording in schema_migrations...");
    await client.query(
      `INSERT INTO schema_migrations (version, name, applied_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (version) DO NOTHING`,
      [MIGRATION_VERSION, MIGRATION_NAME]
    );
    await client.query("COMMIT");

    // Post-state snapshot
    const after = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shop_services' AND column_name = 'ai_custom_instructions'
      ) AS col_exists, EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'service_ai_faq_entries'
      ) AS faq_table_exists, (
        SELECT count(*) FROM service_ai_faq_entries
      ) AS faq_row_count
    `);
    console.log("AFTER:", after.rows[0]);

    const verify = await client.query(
      `SELECT version, name, applied_at FROM schema_migrations WHERE version = $1`,
      [MIGRATION_VERSION]
    );
    console.log("schema_migrations row:", verify.rows[0]);
    console.log("\n✅ Migration 113 applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\n❌ Migration failed, rolled back:", err);
    process.exit(1);
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
