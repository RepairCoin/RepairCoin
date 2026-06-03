// Apply + record + verify migration 132 (per-shop PO number uniqueness) on DO.
// Same pattern as scripts/record-and-verify-migration-126.ts.

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MIGRATION_FILE = path.resolve(
  __dirname,
  "../migrations/132_fix_purchase_order_number_uniqueness.sql"
);

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
       VALUES (132, 'fix_purchase_order_number_uniqueness')
       ON CONFLICT (version) DO NOTHING`
    );

    console.log("=== schema_migrations row 132 ===");
    const rec = await client.query(
      `SELECT version, name, applied_at FROM schema_migrations WHERE version = 132`
    );
    log(
      "row exists",
      rec.rows.length === 1 && rec.rows[0].name === "fix_purchase_order_number_uniqueness"
    );

    console.log("\n=== Old global constraint removed ===");
    const oldC = await client.query(
      `SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_po_number_key'`
    );
    log("purchase_orders_po_number_key dropped", oldC.rows.length === 0);

    console.log("\n=== New per-shop constraint present ===");
    const newC = await client.query<{ contype: string }>(
      `SELECT contype FROM pg_constraint WHERE conname = 'unique_shop_po_number'`
    );
    log(
      "unique_shop_po_number is a UNIQUE constraint",
      newC.rows.length === 1 && newC.rows[0].contype === "u"
    );

    console.log("\n=== Constraint covers (shop_id, po_number) ===");
    const cols = await client.query<{ attname: string }>(
      `SELECT a.attname
       FROM pg_constraint c
       JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
       WHERE c.conname = 'unique_shop_po_number'
       ORDER BY k.ord`
    );
    const colNames = cols.rows.map((r) => r.attname);
    log(
      "columns = shop_id, po_number",
      colNames.length === 2 && colNames[0] === "shop_id" && colNames[1] === "po_number",
      colNames.join(", ")
    );

    console.log("\n=== Verdict ===");
    console.log(
      allGood
        ? "  ✓ Migration 132 applied + recorded + verified."
        : "  ✗ Issues detected."
    );
    process.exit(allGood ? 0 : 1);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
