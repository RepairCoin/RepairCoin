// docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/cleanup.ts
//
// Hard-deletes all QA-marked rows from setup-marketing-fixtures.ts:
//   - transactions.reason LIKE 'AIMK-QA-%'
//   - customers.name LIKE 'QA-MKTG-%'
//   - marketing_campaigns rows where created_by_source='ai_agent' and
//     shop_id is the test shop (defensive — catches any AI drafts left
//     dangling from a partial QA pass)
//   - ai_marketing_messages audit rows for the test shop in the last 24h
//     (so re-runs start from a clean audit slate)
//
// Real production rows don't carry the QA name/email pattern (real
// customers don't start with "QA-MKTG-" and don't use @repaircoin.test),
// so this is collision-free against real data.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/cleanup.ts

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
    console.log("Connected — cleaning up AI Marketing QA fixtures.\n");

    // 1. Transactions — match by the AIMK-QA- reason prefix.
    const transactions = await client.query(
      `DELETE FROM transactions WHERE reason LIKE 'AIMK-QA-%'`
    );
    console.log(`Deleted ${transactions.rowCount} QA transaction(s).`);

    // 2. Customers — match by the QA-MKTG- name prefix.
    // We don't soft-delete (no suspended_at update) because these aren't
    // real customers — fully remove the rows.
    const customers = await client.query(
      `DELETE FROM customers WHERE name LIKE 'QA-MKTG-%'`
    );
    console.log(`Deleted ${customers.rowCount} QA customer(s).`);

    // 3. Marketing campaigns — clear all AI drafts for the test shop.
    // Use the same recipient-then-campaign order as reset-daily-drafts.ts
    // to respect FK constraints.
    const recipients = await client.query(
      `DELETE FROM marketing_campaign_recipients
       WHERE campaign_id IN (
         SELECT id FROM marketing_campaigns
         WHERE shop_id = $1
           AND created_by_source = 'ai_agent'
       )`,
      [SHOP_ID]
    );
    console.log(`Deleted ${recipients.rowCount} campaign recipient row(s).`);

    const campaigns = await client.query(
      `DELETE FROM marketing_campaigns
       WHERE shop_id = $1
         AND created_by_source = 'ai_agent'`,
      [SHOP_ID]
    );
    console.log(`Deleted ${campaigns.rowCount} AI campaign(s).`);

    // 4. Audit log — strip recent ai_marketing_messages so re-runs start
    // clean. Last 24h scope means we don't nuke older legitimate audit
    // data if anyone uses the assistant outside QA.
    const audit = await client.query(
      `DELETE FROM ai_marketing_messages
       WHERE shop_id = $1
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [SHOP_ID]
    );
    console.log(`Deleted ${audit.rowCount} audit row(s) from last 24h.`);

    console.log("\n✓ Cleanup complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("cleanup failed:", err);
  process.exit(1);
});
