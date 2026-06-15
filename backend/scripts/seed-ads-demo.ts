// scripts/seed-ads-demo.ts
//
// Seeds a self-contained Ads System demo so the dashboard has something to show
// without any Facebook/Meta connection: one active campaign (AI auto-answer ON),
// two creatives, three leads at different stages, a starter conversation, and 5
// days of performance. Everything is tagged created_by = 'ads-seed-script' and the
// campaign name is prefixed "ZZ Test —", so cleanup-ads-demo.ts removes it cleanly
// (all child rows cascade from the campaign).
//
//   Run:    npx ts-node scripts/seed-ads-demo.ts [shopIdOrName]
//             - no arg → first shop in the DB
//             - arg    → match an exact shop_id, else a name (e.g. "peanut")
//   Undo:   npx ts-node scripts/cleanup-ads-demo.ts
//
// NOTE: .env points at the shared DigitalOcean STAGING DB, so this data lands in
// staging. It's clearly marked and fully removable — run the cleanup when done.

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MARKER = 'ads-seed-script';
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER, password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
    });

const dayStr = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};

(async () => {
  // Resolve the target shop: CLI arg matches an exact shop_id, else a name; with no
  // arg, fall back to the first shop.
  const shopArg = (process.argv[2] || '').trim();
  const shopRes = shopArg
    ? await pool.query(
        `SELECT shop_id, name FROM shops WHERE shop_id = $1 OR name ILIKE $2 ORDER BY shop_id = $1 DESC LIMIT 1`,
        [shopArg, `%${shopArg}%`]
      )
    : await pool.query(`SELECT shop_id, name FROM shops ORDER BY created_at ASC LIMIT 1`);
  if (shopRes.rows.length === 0) throw new Error(`No shop matched "${shopArg || '(first shop)'}".`);
  const shopId = shopRes.rows[0].shop_id;
  const shopName = shopRes.rows[0].name || shopId;

  // Idempotent, but scoped to THIS shop so other shops' seed data is left intact.
  await pool.query(`DELETE FROM ad_campaigns WHERE created_by = $1 AND shop_id = $2`, [MARKER, shopId]);

  const ind = await pool.query(`SELECT id FROM industries WHERE slug = 'repair' LIMIT 1`);
  const industryId = ind.rows[0]?.id ?? null;

  // Campaign — active, AI auto-answer ON so inbound replies are answered.
  const camp = await pool.query(
    `INSERT INTO ad_campaigns
       (shop_id, industry_id, name, platform, daily_budget_cents, status, ai_agent_enabled, notes, created_by, started_at)
     VALUES ($1,$2,'ZZ Test — Demo Campaign','meta',12000,'active',true,'Seeded demo data — safe to delete',$3, now())
     RETURNING id`,
    [shopId, industryId, MARKER]
  );
  const campaignId = camp.rows[0].id;

  // Creatives — one approved, one pending (so the review UI has both states).
  // Neutral copy so it fits any shop type (the AI always answers as the real brand).
  await pool.query(
    `INSERT INTO ad_creatives (campaign_id, creative_type, headline, body, landing_url_type, review_status, reviewed_by, reviewed_at)
     VALUES ($1,'image','Come see us this week','Walk in or book online — we''d love to have you.','booking_page','approved',$2, now())`,
    [campaignId, MARKER]
  );
  await pool.query(
    `INSERT INTO ad_creatives (campaign_id, creative_type, headline, body, landing_url_type, review_status)
     VALUES ($1,'image','This week only','Show this ad for a little something extra.','lead_form','pending')`,
    [campaignId]
  );

  // Leads at three stages.
  const leadRows = [
    { name: 'Test Lead — Maria',  phone: '+15555550101', email: 'maria.test@example.com',  status: 'new' },
    { name: 'Test Lead — Devon',  phone: '+15555550102', email: 'devon.test@example.com',  status: 'contacted' },
    { name: 'Test Lead — Priya',  phone: '+15555550103', email: 'priya.test@example.com',  status: 'booked' },
  ];
  const leadIds: string[] = [];
  for (const l of leadRows) {
    const r = await pool.query(
      `INSERT INTO ad_leads (campaign_id, name, phone, email, lead_status, attribution_method, consent_to_contact, notes)
       VALUES ($1,$2,$3,$4,$5,'manual',true,'seed') RETURNING id`,
      [campaignId, l.name, l.phone, l.email, l.status]
    );
    leadIds.push(r.rows[0].id);
  }

  // Seed conversations so the AI is testable the moment you open "Chat". Messages are
  // intentionally generic (the AI answers as the real shop, whatever its industry).
  const addMsg = (leadId: string, author: 'lead' | 'ai', body: string) =>
    pool.query(
      `INSERT INTO ad_lead_messages (lead_id, direction, author, channel, body, delivery_status)
       VALUES ($1,$2,$3,'sms',$4,'recorded')`,
      [leadId, author === 'lead' ? 'inbound' : 'outbound', author, body]
    );

  // Maria (new): one unanswered inbound → click "AI answer" to see the FIRST reply.
  await addMsg(leadIds[0], 'lead', "Hi! I saw your ad — are you open today, and do you take walk-ins?");

  // Devon (contacted): a real back-and-forth already going → "AI answer" continues it.
  await addMsg(leadIds[1], 'lead', "Hi, do you have anything available this afternoon?");
  await addMsg(leadIds[1], 'ai',   "Hi Devon! Thanks for reaching out — yes, we'd love to see you this afternoon. What time works best for you?");
  await addMsg(leadIds[1], 'lead', "Maybe around 3? And do you have any specials right now?");

  // Priya (booked): a fresh question to answer.
  await addMsg(leadIds[2], 'lead', "Can I place an order for pickup later today?");

  // 5 days of performance — positive ROI so the dashboards show real numbers.
  const perf = [
    { d: 4, spend: 4200, imp: 5200, clk: 180, leads: 3, books: 1, rev: 18000 },
    { d: 3, spend: 3800, imp: 4800, clk: 160, leads: 2, books: 1, rev: 15000 },
    { d: 2, spend: 5100, imp: 6100, clk: 210, leads: 4, books: 2, rev: 32000 },
    { d: 1, spend: 4600, imp: 5500, clk: 195, leads: 3, books: 1, rev: 17000 },
    { d: 0, spend: 2900, imp: 3400, clk: 120, leads: 2, books: 0, rev: 0 },
  ];
  for (const p of perf) {
    await pool.query(
      `INSERT INTO ad_performance_daily
         (campaign_id, date, spend_cents, impressions, clicks, leads_captured, bookings_created, revenue_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (campaign_id, date) DO UPDATE SET
         spend_cents=EXCLUDED.spend_cents, impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks,
         leads_captured=EXCLUDED.leads_captured, bookings_created=EXCLUDED.bookings_created,
         revenue_cents=EXCLUDED.revenue_cents, updated_at=now()`,
      [campaignId, dayStr(p.d), p.spend, p.imp, p.clk, p.leads, p.books, p.rev]
    );
  }

  console.log('✅ Ads demo seeded.');
  console.log(`   shop:      ${shopName} (${shopId})`);
  console.log(`   campaign:  ${campaignId}  "ZZ Test — Demo Campaign" (active, AI auto-answer ON)`);
  console.log(`   creatives: 2 (1 approved, 1 pending)`);
  console.log(`   leads:     ${leadIds.length}, each with a conversation ready to test the AI`);
  console.log(`              • Maria  — 1 unanswered question → "AI answer" gives the first reply`);
  console.log(`              • Devon  — a back-and-forth in progress → "AI answer" continues it`);
  console.log(`              • Priya  — a fresh pickup question`);
  console.log(`   perf:      5 days, positive ROI`);
  console.log('\nTest the AI:  Admin → Ads → "ZZ Test — Demo Campaign" → Leads → "Chat" on a lead → "AI answer".');
  console.log('Run "Run accrual now" in Billing to generate charges.');
  console.log('Undo with: npx ts-node scripts/cleanup-ads-demo.ts');
  await pool.end();
})().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
