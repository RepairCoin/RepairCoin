/**
 * Migration: Add stripe_session_id column to service_orders
 *
 * This column stores the Stripe Checkout Session ID for manual bookings
 * created with QR code or payment link options.
 */

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

async function migrate() {
  try {
    console.log('Checking if stripe_session_id column exists...');

    const check = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'service_orders' AND column_name = 'stripe_session_id'
    `);

    if (check.rows.length > 0) {
      console.log('✓ Column stripe_session_id already exists');
    } else {
      console.log('Adding stripe_session_id column...');
      await pool.query('ALTER TABLE service_orders ADD COLUMN stripe_session_id VARCHAR(255)');
      console.log('✓ Added stripe_session_id column to service_orders');
    }

    console.log('Creating index...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_service_orders_stripe_session ON service_orders(stripe_session_id)');
    console.log('✓ Index created/verified');

    console.log('\nMigration completed successfully!');

  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
