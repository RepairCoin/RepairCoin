// docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/reset-daily-drafts.ts
//
// Deletes AI-originated draft campaigns (status='draft',
// created_by_source='ai_agent') for the test shop so the 50-drafts/day
// guard in MarketingChatController resets without waiting 24h.
//
// Safe — only touches drafts. Sent campaigns (status='sent') are
// untouched.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/reset-daily-drafts.ts

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
    console.log(`Deleting AI-origin drafts for shop '${SHOP_ID}'`);

    const recipients = await client.query(
      `DELETE FROM marketing_campaign_recipients
       WHERE campaign_id IN (
         SELECT id FROM marketing_campaigns
         WHERE shop_id = $1
           AND status = 'draft'
           AND created_by_source = 'ai_agent'
       )`,
      [SHOP_ID]
    );
    console.log(`  Deleted ${recipients.rowCount} recipient row(s).`);

    const campaigns = await client.query(
      `DELETE FROM marketing_campaigns
       WHERE shop_id = $1
         AND status = 'draft'
         AND created_by_source = 'ai_agent'`,
      [SHOP_ID]
    );
    console.log(`  Deleted ${campaigns.rowCount} AI draft campaign(s).`);

    console.log(`✓ 50-drafts/day guard counter reset.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("reset-daily-drafts failed:", err);
  process.exit(1);
});
