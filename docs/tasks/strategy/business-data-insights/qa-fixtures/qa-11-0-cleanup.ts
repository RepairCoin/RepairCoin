// docs/tasks/strategy/business-data-insights/qa-fixtures/qa-11-0-cleanup.ts
//
// QA scenario §11.0 — drop all pinned queries for the test shop so
// §11.1 starts from a clean empty state.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-11-0-cleanup.ts

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
    console.log(`Connected — clearing pinned queries for shop='${SHOP_ID}'\n`);

    const before = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM ai_insights_pinned_queries
       WHERE shop_id = $1`,
      [SHOP_ID]
    );
    console.log(`Before: ${before.rows[0].n} pinned row(s).`);

    const result = await client.query(
      `DELETE FROM ai_insights_pinned_queries WHERE shop_id = $1`,
      [SHOP_ID]
    );
    console.log(`Deleted: ${result.rowCount} row(s).`);

    const after = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM ai_insights_pinned_queries
       WHERE shop_id = $1`,
      [SHOP_ID]
    );
    console.log(`After: ${after.rows[0].n} pinned row(s).`);

    console.log("\n✓ §11.0 cleanup complete. Ready for §11.1 empty-state test.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("§11.0 cleanup failed:", err);
  process.exit(1);
});
