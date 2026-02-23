/**
 * Fix paid booking status
 * Updates a manual booking that was paid but webhook didn't process
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

async function fixPaidBooking() {
  try {
    // Find pending manual bookings
    const pending = await pool.query(`
      SELECT order_id, customer_address, service_id, status, payment_status,
             booking_date, booking_time_slot, total_amount, created_at
      FROM service_orders
      WHERE booking_type = 'manual'
        AND status = 'pending'
        AND payment_status = 'pending'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('=== Pending Manual Bookings ===\n');

    if (pending.rows.length === 0) {
      console.log('No pending manual bookings found.');
      return;
    }

    for (const row of pending.rows) {
      console.log('Order ID:', row.order_id);
      console.log('Amount: $' + row.total_amount);
      console.log('Date:', row.booking_date, 'Time:', row.booking_time_slot);
      console.log('');
    }

    // Update the specific order (the $49.98 one from testlala)
    const orderId = '779a9637-690a-43bf-af2b-48b7635420a9'; // From earlier query

    console.log(`\nUpdating order ${orderId} to confirmed/paid...`);

    const result = await pool.query(`
      UPDATE service_orders
      SET status = 'paid',
          payment_status = 'paid',
          updated_at = NOW()
      WHERE order_id = $1
      RETURNING order_id, status, payment_status
    `, [orderId]);

    if (result.rows.length > 0) {
      console.log('✓ Order updated successfully!');
      console.log('  Status:', result.rows[0].status);
      console.log('  Payment:', result.rows[0].payment_status);
    } else {
      console.log('Order not found or already updated.');
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixPaidBooking();
