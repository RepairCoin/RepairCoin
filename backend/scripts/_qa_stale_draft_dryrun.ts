// READ-ONLY. Runs the sweeper's exact predicate as a SELECT so the column names and the NOT EXISTS
// join are checked against the live schema, and so we know what the first nightly pass would remove.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DAYS = 60;

async function main() {
  const db = new Client({
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT || 25060),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const q = async (label: string, where: string) => {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int n FROM marketing_campaigns mc WHERE ${where}`
    );
    console.log(`  ${String(rows[0].n).padStart(4)}  ${label}`);
  };

  console.log('\nmarketing_campaigns, platform-wide:');
  await q('total', 'TRUE');
  await q("ai_agent drafts, never sent", "mc.created_by_source = 'ai_agent' AND mc.status = 'draft' AND mc.sent_at IS NULL");
  await q(`  ...of those, older than ${DAYS}d`, `mc.created_by_source = 'ai_agent' AND mc.status = 'draft' AND mc.sent_at IS NULL AND mc.created_at < NOW() - INTERVAL '${DAYS} days'`);

  // The full predicate, verbatim from the sweeper.
  const { rows } = await db.query(
    `SELECT mc.id, mc.shop_id, mc.name, mc.created_at::date
       FROM marketing_campaigns mc
      WHERE mc.created_by_source = 'ai_agent'
        AND mc.status = 'draft'
        AND mc.sent_at IS NULL
        AND mc.created_at < NOW() - INTERVAL '${DAYS} days'
        AND NOT EXISTS (
          SELECT 1 FROM shop_auto_messages am
           WHERE am.action_type = 'run_campaign'
             AND am.action_payload->>'campaignId' = mc.id::text
        )
      ORDER BY mc.created_at`
  );
  console.log(`\nWOULD DELETE on the first nightly pass: ${rows.length}`);
  const byShop = rows.reduce((acc: Record<string, number>, r: any) => {
    acc[r.shop_id] = (acc[r.shop_id] || 0) + 1;
    return acc;
  }, {});
  Object.entries(byShop).forEach(([s, n]) => console.log(`  ${String(n).padStart(4)}  ${s}`));
  if (rows.length) {
    console.log(`\n  oldest: ${rows[0].created_at.toISOString().slice(0, 10)}  "${rows[0].name}"`);
    console.log(`  newest: ${rows[rows.length - 1].created_at.toISOString().slice(0, 10)}  "${rows[rows.length - 1].name}"`);
  }

  // What the guards are protecting, so the numbers are visible rather than assumed.
  console.log('\nprotected by each clause (would be deleted if the clause were dropped):');
  const protectedBy = async (label: string, where: string) => {
    const { rows: r } = await db.query(`SELECT COUNT(*)::int n FROM marketing_campaigns mc WHERE ${where}`);
    console.log(`  ${String(r[0].n).padStart(4)}  ${label}`);
  };
  await protectedBy('manual drafts >60d (created_by_source guard)', `mc.created_by_source <> 'ai_agent' AND mc.status = 'draft' AND mc.sent_at IS NULL AND mc.created_at < NOW() - INTERVAL '${DAYS} days'`);
  await protectedBy('ai_agent campaigns already sent (sent_at guard)', `mc.created_by_source = 'ai_agent' AND (mc.sent_at IS NOT NULL OR mc.status <> 'draft') AND mc.created_at < NOW() - INTERVAL '${DAYS} days'`);
  await protectedBy('ai_agent drafts referenced by a workflow (NOT EXISTS guard)', `mc.created_by_source = 'ai_agent' AND mc.status = 'draft' AND mc.sent_at IS NULL AND EXISTS (SELECT 1 FROM shop_auto_messages am WHERE am.action_type = 'run_campaign' AND am.action_payload->>'campaignId' = mc.id::text)`);
  await protectedBy(`ai_agent drafts newer than ${DAYS}d (age guard)`, `mc.created_by_source = 'ai_agent' AND mc.status = 'draft' AND mc.sent_at IS NULL AND mc.created_at >= NOW() - INTERVAL '${DAYS} days'`);

  await db.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
