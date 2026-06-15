// scripts/simulate-lead-reply.ts
//
// Play the CUSTOMER side: post a new inbound message from a lead, exactly as if they
// texted the shop back. If the lead's campaign has AI auto-answer ON, the AI replies
// on its own (real Anthropic call) — so you can watch the full back-and-forth loop in
// the browser. Drives the same handleInbound() the public /ads/leads/inbound webhook
// uses.
//
//   npx ts-node scripts/simulate-lead-reply.ts <shop> <leadNameOrId> "<message>"
//
//   e.g. npx ts-node scripts/simulate-lead-reply.ts peanut devon "Sounds good — do you have oat milk?"
//        npx ts-node scripts/simulate-lead-reply.ts peanut maria "Are you open on Sundays?"
//
// After it runs, refresh the lead's "Chat" in the browser to see the new exchange.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const shopArg = (process.argv[2] || '').trim();
const leadArg = (process.argv[3] || '').trim();
const message = process.argv.slice(4).join(' ').trim();

if (!shopArg || !leadArg || !message) {
  console.error('Usage: npx ts-node scripts/simulate-lead-reply.ts <shop> <leadNameOrId> "<message>"');
  process.exit(1);
}

const raw = new Pool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
});

(async () => {
  const { leadAutoAnswerService } = await import('../src/domains/AdsDomain/services/LeadAutoAnswerService');

  // Resolve the shop, then a lead within its campaigns by id or name fragment.
  const shopRow = await raw.query(
    `SELECT shop_id FROM shops WHERE shop_id = $1 OR name ILIKE $2 ORDER BY shop_id = $1 DESC LIMIT 1`,
    [shopArg, `%${shopArg}%`]
  );
  if (shopRow.rows.length === 0) { console.error(`No shop matched "${shopArg}".`); process.exit(1); }
  const shopId = shopRow.rows[0].shop_id;

  const leadRow = await raw.query(
    `SELECT l.id, l.name FROM ad_leads l
       JOIN ad_campaigns c ON c.id = l.campaign_id
      WHERE c.shop_id = $1 AND (l.id::text = $2 OR l.name ILIKE $3) AND c.deleted_at IS NULL
      ORDER BY l.created_at DESC LIMIT 1`,
    [shopId, leadArg, `%${leadArg}%`]
  );
  if (leadRow.rows.length === 0) { console.error(`No lead matched "${leadArg}" for shop ${shopId}.`); process.exit(1); }
  const leadId = leadRow.rows[0].id;
  const leadName = leadRow.rows[0].name || 'Lead';

  console.log(`\nCustomer (${leadName}) → ${shopId}:`);
  console.log(`  ${message}\n`);

  const result = await leadAutoAnswerService.handleInbound(leadId, message);

  if (result.autoAnswered && result.reply) {
    console.log(`AI (as the shop) replied:`);
    console.log(`  ${result.reply.body}\n`);
    console.log(`(delivery: ${result.reply.deliveryStatus} — transport off, so it's saved for manual relay)`);
  } else if (result.reason === 'ai_agent_disabled') {
    console.log(`[AI auto-answer is OFF for this campaign — the message was stored, no reply generated.]`);
    console.log(`Turn it on in the campaign header, or use "AI answer" in the Chat modal.`);
  } else {
    console.log(`[No AI reply — ${result.reason || 'unknown reason'}. Message was stored.]`);
  }

  console.log(`\nRefresh "${leadName}" → Chat in the browser to see the new exchange.`);
  await raw.end();
  process.exit(0);
})().catch((e) => { console.error('Simulate failed:', e.message); process.exit(1); });
