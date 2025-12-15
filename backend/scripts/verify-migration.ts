import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  try {
    // Check table exists
    const tableResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'review_helpful_votes'
      ORDER BY ordinal_position
    `);

    console.log('✅ Table review_helpful_votes columns:');
    tableResult.rows.forEach(row => console.log('  -', row.column_name, ':', row.data_type));

    // Check trigger exists
    const triggerResult = await pool.query(`
      SELECT trigger_name FROM information_schema.triggers
      WHERE trigger_name = 'trigger_sync_helpful_count'
    `);

    if (triggerResult.rows.length > 0) {
      console.log('✅ Trigger trigger_sync_helpful_count exists');
    } else {
      console.log('❌ Trigger not found');
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

verify();
