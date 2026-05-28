// docs/tasks/strategy/business-data-insights/qa-fixtures/qa-12-inventory-cleanup.ts
//
// Cleanup for §12 QA scenarios. Hard-deletes the synthetic inventory
// rows inserted by qa-12-inventory-setup.ts.
//
// Targeted patterns (real shop data does not match):
//   • inventory_adjustments.reason LIKE 'AINV-QA-%'
//   • inventory_items.name        LIKE 'QA-INV-%'
//
// inventory_adjustments has ON DELETE CASCADE from inventory_items.id,
// so deleting items also removes their adjustments — but we delete
// adjustments by reason-pattern FIRST as a belt-and-suspenders guard
// against any QA-marked adjustments whose parent item somehow got
// detached or was already deleted in a partial run.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-12-inventory-cleanup.ts

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
    console.log(
      `Connected — cleaning §12 inventory fixtures for shop='${SHOP_ID}'.\n`
    );

    // 1. Delete adjustments by reason-pattern first (belt + suspenders).
    const adj = await client.query(
      `DELETE FROM inventory_adjustments
       WHERE shop_id = $1
         AND reason LIKE 'AINV-QA-%'`,
      [SHOP_ID]
    );
    console.log(
      `Deleted ${adj.rowCount} adjustment row(s) matching 'AINV-QA-%'.`
    );

    // 2. Delete items by name-pattern. CASCADEs any still-attached adjustments.
    const items = await client.query(
      `DELETE FROM inventory_items
       WHERE shop_id = $1
         AND name LIKE 'QA-INV-%'`,
      [SHOP_ID]
    );
    console.log(`Deleted ${items.rowCount} item row(s) matching 'QA-INV-%'.`);

    // 3. Sanity check — what real inventory remains on the test shop.
    const remaining = await client.query<{
      n_items: string;
      n_adjustments: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM inventory_items
          WHERE shop_id = $1 AND deleted_at IS NULL) AS n_items,
         (SELECT COUNT(*)::text FROM inventory_adjustments
          WHERE shop_id = $1) AS n_adjustments`,
      [SHOP_ID]
    );
    const r = remaining.rows[0];
    console.log(
      `\nRemaining for shop='${SHOP_ID}' (non-QA, real data): ${r.n_items} item(s), ${r.n_adjustments} adjustment(s).`
    );

    console.log("\n✓ §12 cleanup complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("§12 cleanup failed:", err);
  process.exit(1);
});
