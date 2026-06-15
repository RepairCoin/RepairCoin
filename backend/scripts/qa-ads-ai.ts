// scripts/qa-ads-ai.ts
//
// End-to-end QA for the Ads System AI (Stage 3 draft + Stage 3.5 full auto-answer).
// Spins up a throwaway campaign + lead on a shop, then drives every AI entry point
// with REAL Anthropic calls and prints the actual generated replies, so you can both
// verify it works AND read what the AI says. Cleans up after itself.
//
//   Run:    npx ts-node scripts/qa-ads-ai.ts [shopIdOrName]   (default: peanut)
//   Keep:   npx ts-node scripts/qa-ads-ai.ts peanut --keep    (leave the test data to click in the UI)
//   Clean:  npx ts-node scripts/qa-ads-ai.ts --clean [shop]   (remove any leftover QA campaign)
//
// NOTE: makes ~3 live Haiku calls (a few cents at most) and needs ANTHROPIC_API_KEY.
// Data lands in the shared DO staging DB; the throwaway campaign cascades clean.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const argv = process.argv.slice(2);
const clean = argv.includes('--clean');
const keep = argv.includes('--keep');
const SHOP = (argv.find((a) => !a.startsWith('--')) || 'peanut').trim();
const MARKER = 'ads-ai-qa';

const raw = new Pool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
});

let pass = 0, fail = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  → ' + detail : ''}`);
  cond ? pass++ : fail++;
};
const say = (who: string, text: string) => console.log(`        ${who.padEnd(6)}│ ${text}`);

(async () => {
  const { CampaignRepository } = await import('../src/domains/AdsDomain/repositories/CampaignRepository');
  const { LeadRepository } = await import('../src/domains/AdsDomain/repositories/LeadRepository');
  const { AiCostRepository } = await import('../src/domains/AdsDomain/repositories/AiCostRepository');
  const { SpendCapEnforcer } = await import('../src/domains/AIAgentDomain/services/SpendCapEnforcer');
  const { leadAIService } = await import('../src/domains/AdsDomain/services/LeadAIService');
  const { leadAutoAnswerService } = await import('../src/domains/AdsDomain/services/LeadAutoAnswerService');

  const campaigns = new CampaignRepository();
  const leads = new LeadRepository();
  const aiCosts = new AiCostRepository();
  const spendCap = new SpendCapEnforcer();

  const shopRow = await raw.query(
    `SELECT shop_id FROM shops WHERE shop_id = $1 OR name ILIKE $2 ORDER BY shop_id = $1 DESC LIMIT 1`,
    [SHOP, `%${SHOP}%`]
  );
  if (shopRow.rows.length === 0) { console.error(`No shop matched "${SHOP}".`); process.exit(1); }
  const shopId: string = shopRow.rows[0].shop_id;

  if (clean) {
    const r = await raw.query(`DELETE FROM ad_campaigns WHERE created_by = $1 AND shop_id = $2`, [MARKER, shopId]);
    console.log(`Removed ${r.rowCount} QA campaign(s) for ${shopId}.`);
    await raw.end(); return;
  }

  console.log(`\n=== QA: Ads AI (draft + auto-answer) — shop: ${shopId} ===\n`);

  // Fresh throwaway campaign (AI agent ON) + lead.
  await raw.query(`DELETE FROM ad_campaigns WHERE created_by = $1 AND shop_id = $2`, [MARKER, shopId]);
  const campaign = await campaigns.create({
    shopId, name: 'ZZ AI QA Campaign', aiAgentEnabled: true, dailyBudgetCents: 10000, createdBy: MARKER,
  });
  const lead = await leads.create({
    campaignId: campaign.id, name: 'QA Lead — Sam', phone: '+15555559001', email: 'sam.qa@example.com',
    attributionMethod: 'manual', consentToContact: true,
  });
  console.log(`setup: campaign ${campaign.id} (AI on), lead ${lead.id}\n`);

  // [0] Spend-cap gate is reachable (lazily provisions a budget for a new shop).
  try {
    const cap = await spendCap.canSpend(shopId);
    ok('0. Spend-cap gate reachable', cap.allowed === true || cap.allowed === false,
      `allowed=${cap.allowed}, spend=$${cap.currentSpendUsd ?? '?'}`);
  } catch (e: any) { ok('0. Spend-cap gate reachable', false, e.message); }

  // [1] Stage 3 — AI-drafted first outreach (Option C).
  console.log('\nStage 3 — AI draft outreach');
  try {
    const d = await leadAIService.draftOutreach(lead.id);
    ok('1. Draft generated (non-empty)', !!d.draft && d.draft.length > 10, `cost $${d.costUsd.toFixed(5)}`);
    say('AI', d.draft);
  } catch (e: any) { ok('1. Draft generated', false, e.message); }

  // [2] Stage 3.5 — lead replies, AI auto-answers (agent ON).
  console.log('\nStage 3.5 — full auto-answer (agent ON)');
  try {
    const r = await leadAutoAnswerService.handleInbound(lead.id, 'Hi! How much for an iPhone 13 screen, and could you do it today?');
    ok('2. Inbound auto-answered', r.autoAnswered && !!r.reply, r.reason ? `reason=${r.reason}` : 'replied');
    say('Lead', r.inbound.body);
    if (r.reply) say('AI', r.reply.body);
  } catch (e: any) { ok('2. Inbound auto-answered', false, e.message); }

  // [3] Multi-turn — the AI should use the prior context.
  try {
    const r = await leadAutoAnswerService.handleInbound(lead.id, 'Perfect. Can I come by around 3pm?');
    ok('3. Multi-turn reply (uses history)', r.autoAnswered && !!r.reply);
    say('Lead', 'Perfect. Can I come by around 3pm?');
    if (r.reply) say('AI', r.reply.body);
  } catch (e: any) { ok('3. Multi-turn reply', false, e.message); }

  // [4] Admin can post a manual reply into the same thread.
  try {
    const m = await leadAutoAnswerService.sendAdminMessage(lead.id, 'Hi Sam — 3pm is booked. See you then!');
    ok('4. Admin manual reply stored + delivered', m.author === 'admin' && m.direction === 'outbound', `delivery=${m.deliveryStatus}`);
  } catch (e: any) { ok('4. Admin manual reply', false, e.message); }

  // [5] Toggle agent OFF → inbound is recorded but NOT auto-answered (draft-only mode).
  console.log('\nStage 3.5 — agent OFF (draft-only fallback)');
  try {
    await campaigns.update(campaign.id, { aiAgentEnabled: false });
    const r = await leadAutoAnswerService.handleInbound(lead.id, 'Actually, can you replace the battery too?');
    ok('5. Inbound NOT auto-answered when agent off', !r.autoAnswered && r.reason === 'ai_agent_disabled', `reason=${r.reason}`);
  } catch (e: any) { ok('5. Agent-off fallback', false, e.message); }

  // [6] Per-campaign AI cost was ledgered (Q6 true-margin input).
  try {
    const cents = await aiCosts.getCampaignCostCents(campaign.id);
    ok('6. AI cost recorded to the campaign ledger', cents > 0, `$${(cents / 100).toFixed(5)}`);
  } catch (e: any) { ok('6. AI cost ledgered', false, e.message); }

  // [7] Lead lifecycle — first AI/admin response marked it contacted.
  try {
    const fresh = await leads.findById(lead.id);
    ok('7. Lead marked contacted + first_response_at set', fresh?.leadStatus === 'contacted' && !!fresh?.firstResponseAt);
  } catch (e: any) { ok('7. Lead lifecycle', false, e.message); }

  // [8] Whole thread persisted; transport off → outbound is "recorded".
  try {
    const thread = await leadAutoAnswerService.getThread(lead.id);
    const outbound = thread.filter((m) => m.direction === 'outbound');
    ok('8. Conversation persisted', thread.length >= 5, `${thread.length} messages`);
    ok('9. Transport off → outbound recorded (not auto-sent)', outbound.every((m) => m.deliveryStatus === 'recorded'));
    console.log('\n  Full thread:');
    thread.forEach((m) => say(m.author, m.body));
  } catch (e: any) { ok('8/9. Thread', false, e.message); }

  console.log(`\n──────────────────────────────────────────────`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? `, ${fail} FAILED` : ' ✅'}`);

  if (keep) {
    console.log(`\nKept the QA campaign so you can click it in the UI (Admin → Ads → "ZZ AI QA Campaign").`);
    console.log(`Remove it with:  npx ts-node scripts/qa-ads-ai.ts --clean ${shopId}`);
  } else {
    await raw.query(`DELETE FROM ad_campaigns WHERE created_by = $1 AND shop_id = $2`, [MARKER, shopId]);
    console.log(`\nCleaned up the throwaway campaign (cascade). Use --keep to leave it for UI testing.`);
  }

  await raw.end();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('QA failed:', e.message); process.exit(1); });
