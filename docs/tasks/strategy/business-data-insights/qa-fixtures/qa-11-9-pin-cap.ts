// docs/tasks/strategy/business-data-insights/qa-fixtures/qa-11-9-pin-cap.ts
//
// QA scenario §11.9 — 50-pin cap per shop returns 409.
//
// 1. Clear any existing pins for the test shop (including the 2
//    you just pinned in §11.12).
// 2. Seed 50 synthetic pins so the shop is exactly at the cap.
// 3. User attempts to pin a 51st via the UI → expect PinButton's
//    brief red error state + COUNT(*) still 50 in the DB.
//
// To clean up afterwards, run qa-11-9-cleanup.ts (separate script
// — kept out of this one so the user can verify the cap before
// the fakes get deleted).
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-11-9-pin-cap.ts

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
    console.log(`Connected — running §11.9 setup for shop='${SHOP_ID}'\n`);

    // 1. Clear existing pins (the 2 from §11.12 + any leftovers).
    const cleared = await client.query(
      `DELETE FROM ai_insights_pinned_queries WHERE shop_id = $1`,
      [SHOP_ID]
    );
    console.log(`Step 1 — Cleared ${cleared.rowCount} existing pin(s).`);

    // 2. Seed exactly 50 synthetic pins via generate_series.
    //    Distinctive prefix "fake question " so the cleanup
    //    script targets only these rows.
    const seeded = await client.query<{ n: string }>(
      `WITH inserted AS (
         INSERT INTO ai_insights_pinned_queries (shop_id, question_text)
         SELECT $1, 'fake question ' || g.i
         FROM generate_series(1, 50) AS g(i)
         RETURNING id
       )
       SELECT COUNT(*)::text AS n FROM inserted`,
      [SHOP_ID]
    );
    console.log(`Step 2 — Seeded ${seeded.rows[0].n} synthetic pins.`);

    // 3. Confirm the count.
    const total = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM ai_insights_pinned_queries WHERE shop_id = $1`,
      [SHOP_ID]
    );
    console.log(`Step 3 — Total pins for shop now: ${total.rows[0].n} (should be 50).`);

    console.log("\n✓ §11.9 setup complete.");
    console.log("\nVerify on the panel:");
    console.log("  1. Close + reopen panel, switch to Pinned tab → badge should read '50'.");
    console.log("     You'll see 50 rows of 'fake question 1', 'fake question 2', etc.");
    console.log("  2. Switch back to Chat. Ask a fresh question (e.g. tap a starter chip).");
    console.log("  3. On the resulting data card, click the Pin button.");
    console.log("  4. EXPECT:");
    console.log("     - Pin button briefly turns RED for ~2 seconds, then reverts to idle.");
    console.log("     - Badge stays at '50' — no row added.");
    console.log("  5. DB check (this will confirm): no new pin was created.");
    console.log("\nWhen done verifying, run cleanup:");
    console.log("  cd backend && npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/qa-11-9-cleanup.ts");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("§11.9 setup failed:", err);
  process.exit(1);
});
