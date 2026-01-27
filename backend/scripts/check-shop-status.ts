import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function check() {
  const result = await pool.query(
    `SELECT shop_id, name, active, verified, suspended_at, suspension_reason, operational_status
     FROM shops WHERE shop_id = $1`,
    ['dc_shopu']
  );
  console.log('DC Shopuo status:');
  console.log(JSON.stringify(result.rows[0], null, 2));
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
