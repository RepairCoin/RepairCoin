import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function update() {
  try {
    const result = await pool.query(
      'UPDATE shop_time_slot_config SET booking_advance_days = 5, updated_at = NOW() WHERE shop_id = $1 RETURNING *',
      ['dc_shopu']
    );
    console.log('Updated config:');
    console.log(JSON.stringify(result.rows[0], null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

update();
