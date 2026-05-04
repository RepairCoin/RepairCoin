/**
 * Read-only: look up customer records by email (and any tied data).
 *
 * Usage:
 *   npx ts-node scripts/check-customer-by-email.ts anna.cagunot@gmail.com
 *
 * Safety: refuses to run against prod.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { Pool } from 'pg';

const EMAIL = process.argv[2];
if (!EMAIL) {
  console.error('Usage: npx ts-node scripts/check-customer-by-email.ts <email>');
  process.exit(1);
}

const dbHost = process.env.DB_HOST || '';
if (dbHost.toLowerCase().includes('prod')) {
  console.error('REFUSING: staging only.');
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
       WHERE table_name = 'customers'
         AND column_name IN ('address','wallet_address','email','first_name','last_name','name','tier','no_show_count','no_show_tier','suspended_at','created_at','referral_code')`
    );
    const colNames = cols.rows.map((r) => r.column_name).join(', ');

    const r = await c.query(
      `SELECT ${colNames} FROM customers WHERE LOWER(email) = LOWER($1)`,
      [EMAIL]
    );

    if (r.rows.length === 0) {
      console.log('No customer rows matched this email.');
    } else {
      console.log(`Found ${r.rows.length} customer row(s):\n`);
      for (const row of r.rows) {
        for (const [k, v] of Object.entries(row)) {
          console.log(`  ${k.padEnd(22)} ${v ?? '(null)'}`);
        }
        console.log('  ---');
      }
    }

    // Tied data summary per customer address
    if (r.rows.length > 0) {
      console.log('\nRelated row counts per customer:\n');
      for (const row of r.rows as any[]) {
        const addr = (row.address || row.wallet_address || '').toString().toLowerCase();
        if (!addr) continue;
        console.log(`  customer ${addr}:`);

        const tables: { name: string; col: string; ci?: boolean }[] = [
          { name: 'service_orders', col: 'customer_address', ci: true },
          { name: 'service_reviews', col: 'customer_address', ci: true },
          { name: 'service_favorites', col: 'customer_address', ci: true },
          { name: 'recently_viewed_services', col: 'customer_address', ci: true },
          { name: 'review_helpful_votes', col: 'customer_address', ci: true },
          { name: 'no_show_history', col: 'customer_address', ci: true },
          { name: 'reschedule_requests', col: 'customer_address', ci: true },
          { name: 'appointment_reschedule_requests', col: 'customer_address', ci: true },
          { name: 'transactions', col: 'customer_address', ci: true },
          { name: 'notifications', col: 'receiver_address', ci: true },
          { name: 'conversations', col: 'customer_address', ci: true },
          { name: 'messages', col: 'sender_address', ci: true },
          { name: 'push_subscriptions', col: 'user_address', ci: true },
          { name: 'device_push_tokens', col: 'wallet_address', ci: true },
          { name: 'refresh_tokens', col: 'wallet_address', ci: true },
          { name: 'customer_blocks', col: 'customer_address', ci: true },
          { name: 'customer_rcn_sources', col: 'customer_address', ci: true },
          { name: 'group_token_balances', col: 'customer_address', ci: true },
          { name: 'group_token_transactions', col: 'customer_address', ci: true },
          { name: 'shop_group_memberships', col: 'customer_address', ci: true },
        ];

        for (const t of tables) {
          const tableExistsResult = await c.query(
            `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS ex`,
            [t.name]
          );
          if (!tableExistsResult.rows[0]?.ex) continue;

          const colExistsResult = await c.query(
            `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2) AS ex`,
            [t.name, t.col]
          );
          if (!colExistsResult.rows[0]?.ex) continue;

          const where = t.ci ? `LOWER(${t.col}) = LOWER($1)` : `${t.col} = $1`;
          const cr = await c.query(
            `SELECT COUNT(*)::int AS cnt FROM ${t.name} WHERE ${where}`,
            [addr]
          );
          const cnt = cr.rows[0]?.cnt || 0;
          if (cnt > 0) console.log(`    ${t.name.padEnd(38)} ${cnt}`);
        }
      }
    }
  } finally {
    c.release();
    await pool.end();
  }
})();
