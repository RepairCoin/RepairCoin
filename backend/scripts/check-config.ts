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

async function check() {
  try {
    const result = await pool.query('SELECT * FROM shop_time_slot_config WHERE shop_id = $1', ['dc_shopu']);
    console.log('Database config for dc_shopu:');
    console.log(JSON.stringify(result.rows[0], null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

check();
