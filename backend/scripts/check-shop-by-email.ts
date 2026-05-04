/**
 * Read-only: look up shop records by email.
 *
 * Usage:
 *   npx ts-node scripts/check-shop-by-email.ts anna.cagunot@gmail.com
 *
 * Safety: refuses to run against prod.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { Pool } from 'pg';

const EMAIL = process.argv[2];
if (!EMAIL) {
  console.error('Usage: npx ts-node scripts/check-shop-by-email.ts <email>');
  process.exit(1);
}

const dbHost = process.env.DB_HOST || '';
if (dbHost.toLowerCase().includes('prod')) {
  console.error('❌ REFUSING: staging only.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

(async () => {
  console.log(`Target DB: ${dbHost}`);
  console.log(`Email: ${EMAIL}\n`);

  const c = await pool.connect();
  try {
    const cols = await c.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'shops' AND column_name IN
         ('shop_id','wallet_address','name','email','verified','active','created_at','suspended_at')`
    );
    const colNames = cols.rows.map((r) => r.column_name).join(', ');

    const r = await c.query(
      `SELECT ${colNames} FROM shops WHERE LOWER(email) = LOWER($1)`,
      [EMAIL]
    );

    if (r.rows.length === 0) {
      console.log('✗ No shop rows matched this email.');
      return;
    }

    console.log(`✓ Found ${r.rows.length} shop row(s):\n`);
    for (const row of r.rows) {
      for (const [k, v] of Object.entries(row)) {
        console.log(`  ${k.padEnd(22)} ${v ?? '(null)'}`);
      }
      console.log('  ---');
    }
  } finally {
    c.release();
    await pool.end();
  }
})();
