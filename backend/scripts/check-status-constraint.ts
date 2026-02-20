import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '25060'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const result = await pool.query(`
    SELECT pg_get_constraintdef(oid) as constraint_def
    FROM pg_constraint
    WHERE conname = 'service_orders_status_check'
  `);
  console.log('Status constraint:', result.rows[0]?.constraint_def);

  // Also check what statuses are currently used
  const statuses = await pool.query(`
    SELECT DISTINCT status, COUNT(*) as count
    FROM service_orders
    GROUP BY status
    ORDER BY count DESC
  `);
  console.log('\nCurrent statuses in use:');
  statuses.rows.forEach(r => console.log(`  ${r.status}: ${r.count}`));

  await pool.end();
}

check();
