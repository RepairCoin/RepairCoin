// WRITES TO STAGING — deletes rows. Run only when authorized.
//
// Tests StaleCampaignDraftSweeper by invoking the real sweep(), not a copy of its SQL, so the thing
// under test is the thing that ships.
//
// Every row is snapshotted to a timestamped .json BEFORE the delete, with a restore statement written
// alongside it. A sweep is irreversible by nature; the snapshot is what makes testing it on staging a
// decision that can be taken back.
//
// The assertions afterwards are about what SURVIVED. A sweeper that deleted everything would satisfy
// "37 gone" just as well as a correct one, so the guards are counted before and after and must not move.

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { staleCampaignDraftSweeper, STALE_DRAFT_DAYS } from '../src/services/StaleCampaignDraftSweeper';

const ok = (c: boolean, s: string) => console.log(`  ${c ? 'PASS' : 'FAIL'}  ${s}`);

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

  const count = async (where: string) =>
    (await db.query(`SELECT COUNT(*)::int n FROM marketing_campaigns mc WHERE ${where}`)).rows[0].n as number;

  const AI_DRAFT = "mc.created_by_source = 'ai_agent' AND mc.status = 'draft' AND mc.sent_at IS NULL";
  const MANUAL_DRAFT = "mc.created_by_source <> 'ai_agent' AND mc.status = 'draft' AND mc.sent_at IS NULL";
  const AI_SENT = "mc.created_by_source = 'ai_agent' AND (mc.sent_at IS NOT NULL OR mc.status <> 'draft')";
  const RECENT_AI_DRAFT = `${AI_DRAFT} AND mc.created_at >= NOW() - INTERVAL '${STALE_DRAFT_DAYS} days'`;
  const REFERENCED = `${AI_DRAFT} AND EXISTS (SELECT 1 FROM shop_auto_messages am WHERE am.action_type = 'run_campaign' AND am.action_payload->>'campaignId' = mc.id::text)`;

  console.log('\n=== 1. snapshot everything the sweep will remove ===');
  const { rows: doomed } = await db.query(
    `SELECT mc.* FROM marketing_campaigns mc
      WHERE ${AI_DRAFT}
        AND mc.created_at < NOW() - INTERVAL '${STALE_DRAFT_DAYS} days'
        AND NOT EXISTS (
          SELECT 1 FROM shop_auto_messages am
           WHERE am.action_type = 'run_campaign'
             AND am.action_payload->>'campaignId' = mc.id::text
        )`
  );
  const stamp = (await db.query(`SELECT to_char(NOW(),'YYYYMMDD-HH24MISS') s`)).rows[0].s;
  const backup = path.resolve(__dirname, `../_qa_swept_drafts_${stamp}.json`);
  fs.writeFileSync(backup, JSON.stringify(doomed, null, 2));
  console.log(`  ${doomed.length} rows -> ${backup}`);
  console.log(`  restore with: npx ts-node scripts/_qa_stale_draft_restore.ts ${path.basename(backup)}`);

  const before = {
    total: await count('TRUE'),
    manualDrafts: await count(MANUAL_DRAFT),
    aiSent: await count(AI_SENT),
    recentAiDrafts: await count(RECENT_AI_DRAFT),
    referenced: await count(REFERENCED),
  };
  console.log('\n  before:', JSON.stringify(before));

  console.log('\n=== 2. run the real sweep() ===');
  const result = await staleCampaignDraftSweeper.sweep();
  console.log(`  sweep() returned ${JSON.stringify(result)}`);
  ok(result.deleted === doomed.length, `deleted the ${doomed.length} it was supposed to`);

  console.log('\n=== 3. what survived — the part that actually matters ===');
  const after = {
    total: await count('TRUE'),
    manualDrafts: await count(MANUAL_DRAFT),
    aiSent: await count(AI_SENT),
    recentAiDrafts: await count(RECENT_AI_DRAFT),
    referenced: await count(REFERENCED),
  };
  console.log('  after: ', JSON.stringify(after));
  ok(after.manualDrafts === before.manualDrafts, `all ${before.manualDrafts} manual drafts untouched`);
  ok(after.aiSent === before.aiSent, `all ${before.aiSent} already-sent AI campaigns untouched`);
  ok(after.recentAiDrafts === before.recentAiDrafts, `all ${before.recentAiDrafts} drafts under ${STALE_DRAFT_DAYS}d untouched`);
  ok(after.referenced === before.referenced, `all ${before.referenced} workflow-referenced drafts untouched`);
  ok(before.total - after.total === result.deleted, 'nothing was removed beyond what it reported');

  console.log('\n=== 4. no live workflow was left pointing at nothing ===');
  const { rows: orphans } = await db.query(
    `SELECT am.id, am.name, am.shop_id, am.action_payload->>'campaignId' cid
       FROM shop_auto_messages am
      WHERE am.action_type = 'run_campaign'
        AND am.action_payload->>'campaignId' IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM marketing_campaigns mc WHERE mc.id::text = am.action_payload->>'campaignId')`
  );
  ok(orphans.length === 0, `no run_campaign rule points at a missing campaign (found ${orphans.length})`);
  orphans.forEach((o: any) => console.log(`    ORPHANED: ${o.shop_id} "${o.name}" -> ${o.cid}`));

  console.log('\n=== 5. it is idempotent — a second pass finds nothing ===');
  const second = await staleCampaignDraftSweeper.sweep();
  ok(second.deleted === 0, `second sweep deleted 0 (got ${second.deleted})`);

  await db.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
