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
    // Check all recent bookings
    const result = await pool.query(`
      SELECT order_id, shop_id, service_id, customer_address, booking_date, booking_time_slot, status, created_at
      FROM service_orders
      WHERE status NOT IN ('cancelled', 'refunded')
      ORDER BY created_at DESC
      LIMIT 15
    `);
    console.log('Recent 15 active bookings:');
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. Date: ${row.booking_date}, Time: ${row.booking_time_slot}, Status: ${row.status}, Customer: ${row.customer_address?.substring(0, 10)}...`);
    });

    // Check bookings for December
    const dec = await pool.query(`
      SELECT booking_date, booking_time_slot, status, COUNT(*) as count
      FROM service_orders
      WHERE booking_date >= '2025-12-01' AND booking_date <= '2025-12-31'
      AND status NOT IN ('cancelled', 'refunded')
      GROUP BY booking_date, booking_time_slot, status
      ORDER BY booking_date, booking_time_slot
    `);
    console.log('\nDecember 2025 bookings summary:');
    console.log(JSON.stringify(dec.rows, null, 2));

    // Check what statuses exist
    const statuses = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM service_orders
      GROUP BY status
    `);
    console.log('\nBooking statuses:');
    console.log(JSON.stringify(statuses.rows, null, 2));

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

check();
