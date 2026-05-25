// docs/tasks/strategy/business-data-insights/qa-fixtures/qa-11-9-cleanup.ts
//
// Cleanup for §11.9 — hard-deletes the 50 synthetic "fake question N"
// pins seeded by qa-11-9-pin-cap.ts. Targets only rows with the
// distinctive prefix so real user-pinned questions stay intact.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-11-9-cleanup.ts

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
    console.log(`Connected — cleaning up §11.9 fake pins for shop='${SHOP_ID}'\n`);

    const result = await client.query(
      `DELETE FROM ai_insights_pinned_queries
       WHERE shop_id = $1
         AND question_text LIKE 'fake question %'`,
      [SHOP_ID]
    );
    console.log(`Deleted ${result.rowCount} synthetic pin(s).`);

    const remaining = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM ai_insights_pinned_queries WHERE shop_id = $1`,
      [SHOP_ID]
    );
    console.log(`Remaining pins for shop: ${remaining.rows[0].n}.`);

    console.log("\n✓ §11.9 cleanup complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("§11.9 cleanup failed:", err);
  process.exit(1);
});
