// docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/reset-spend-cap.ts
//
// Resets the AI monthly spend counter to zero for the test shop so QA
// can keep running scenarios without hitting the 429 budget-exhausted
// path. Touches only ai_shop_settings.current_month_spend_usd for the
// target shop — does NOT change other shops or the monthly_budget_usd
// ceiling.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/reset-spend-cap.ts

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../../../../backend/.env"),
});

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
    console.log(`Resetting AI spend cap for shop '${SHOP_ID}'`);

    const before = await client.query<{
      monthly_budget_usd: string;
      current_month_spend_usd: string;
    }>(
      `SELECT monthly_budget_usd, current_month_spend_usd
       FROM ai_shop_settings
       WHERE shop_id = $1`,
      [SHOP_ID]
    );

    if (before.rowCount === 0) {
      console.log(
        `No ai_shop_settings row for shop '${SHOP_ID}'. Nothing to reset.`
      );
      return;
    }

    const prevSpend = parseFloat(before.rows[0].current_month_spend_usd);
    const budget = parseFloat(before.rows[0].monthly_budget_usd);
    console.log(`  Before: $${prevSpend.toFixed(4)} / $${budget.toFixed(2)} budget`);

    const update = await client.query(
      `UPDATE ai_shop_settings
       SET current_month_spend_usd = 0,
           current_month_started_at = NOW(),
           updated_at = NOW()
       WHERE shop_id = $1`,
      [SHOP_ID]
    );

    console.log(`  After:  $0.0000 / $${budget.toFixed(2)} budget`);
    console.log(`✓ Reset ${update.rowCount} row(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("reset-spend-cap failed:", err);
  process.exit(1);
});
