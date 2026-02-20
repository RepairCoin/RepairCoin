import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '25060'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function findUnpaidManualBookings() {
  try {
    const result = await pool.query(`
      SELECT
        order_id,
        customer_address,
        service_id,
        status,
        payment_status,
        booking_date,
        booking_time_slot,
        booking_type,
        total_amount,
        created_at
      FROM service_orders
      WHERE booking_type = 'manual'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('=== Unpaid Manual Bookings ===\n');

    if (result.rows.length === 0) {
      console.log('No unpaid manual bookings found.');
      return;
    }

    for (const row of result.rows) {
      console.log('--- Booking ---');
      console.log('Order ID:', row.order_id);
      console.log('Status:', row.status, '| Payment:', row.payment_status);
      console.log('Date:', row.booking_date, 'Time:', row.booking_time_slot);
      console.log('Amount: $' + row.total_amount);
      console.log('Created:', row.created_at);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

findUnpaidManualBookings();
