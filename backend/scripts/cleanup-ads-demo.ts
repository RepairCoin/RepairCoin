// scripts/cleanup-ads-demo.ts
//
// Removes everything seed-ads-demo.ts created. The seed tags its campaign with
// created_by = 'ads-seed-script'; deleting that campaign cascades to its creatives,
// leads (and their messages), performance rows, safeguards, AI-cost rows, billing
// charges, and experiments — all child FKs are ON DELETE CASCADE. Leaves staging
// exactly as it was. Safe to run multiple times.
//
//   Run:  npx ts-node scripts/cleanup-ads-demo.ts

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

(async () => {
  const ids = await pool.query(`SELECT id FROM ad_campaigns WHERE created_by = $1`, [MARKER]);
  if (ids.rows.length === 0) {
    console.log('Nothing to clean — no seed campaigns found.');
    await pool.end();
    return;
  }
  const campaignIds = ids.rows.map((r) => r.id);

  // Belt-and-suspenders: also drop any Plan-A (campaign-less) billing charges that a
  // manual accrual may have created for these shops during testing. Campaign-scoped
  // rows cascade automatically when the campaign is deleted.
  await pool.query(
    `DELETE FROM ad_billing_charges
      WHERE campaign_id IS NULL AND shop_id IN (
        SELECT shop_id FROM ad_campaigns WHERE id = ANY($1::uuid[])
      )`,
    [campaignIds]
  );

  const del = await pool.query(`DELETE FROM ad_campaigns WHERE created_by = $1`, [MARKER]);
  console.log(`✅ Removed ${del.rowCount} seed campaign(s) and all cascaded child rows.`);
  console.log('   (creatives, leads, messages, performance, safeguards, AI costs, billing charges, experiments)');
  await pool.end();
})().catch((e) => { console.error('Cleanup failed:', e.message); process.exit(1); });
