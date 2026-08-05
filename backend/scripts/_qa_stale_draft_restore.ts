// Puts back exactly what _qa_stale_draft_sweep_live.ts removed, from its snapshot file.
//
// Usage: npx ts-node scripts/_qa_stale_draft_restore.ts _qa_swept_drafts_20260805-152600.json
//
// Column-agnostic on purpose — it rebuilds the INSERT from the keys present in the snapshot, so it keeps
// working when marketing_campaigns gains a column. ON CONFLICT DO NOTHING makes re-running it harmless.

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: _qa_stale_draft_restore.ts <snapshot.json>');
    process.exit(1);
  }
  const full = path.isAbsolute(file) ? file : path.resolve(__dirname, '..', file);
  const rows = JSON.parse(fs.readFileSync(full, 'utf8')) as Record<string, unknown>[];
  if (!rows.length) {
    console.log('snapshot is empty — nothing to restore');
    return;
  }

  const db = new Client({
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT || 25060),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const cols = Object.keys(rows[0]);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO marketing_campaigns (${cols.map((c) => `"${c}"`).join(', ')})
               VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

  let restored = 0;
  for (const r of rows) {
    const res = await db.query(sql, cols.map((c) => r[c]));
    restored += res.rowCount || 0;
  }
  console.log(`restored ${restored} of ${rows.length} (already-present rows skipped)`);
  await db.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
