import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '25060'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('Connected successfully!');

    const migrationPath = path.join(__dirname, '../migrations/055_add_customer_notification_preferences.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration 055_add_customer_notification_preferences.sql...');

    // Execute the full migration as a single transaction
    await client.query(migrationSql);

    console.log('Migration completed successfully!');

    // Verify table exists
    const verifyResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'customer_notification_preferences'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('Verified: customer_notification_preferences table exists');
    }

    // Show columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'customer_notification_preferences'
      ORDER BY ordinal_position
    `);

    console.log('Table columns:', columnsResult.rows.map(r => `${r.column_name} (${r.data_type})`));

    client.release();
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
