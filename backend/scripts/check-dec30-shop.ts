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
    // Check Dec 30 booking details
    const result = await pool.query(`
      SELECT
        order_id, shop_id, service_id, customer_address,
        booking_date, booking_time_slot, status,
        DATE(booking_date) as date_only,
        booking_date::text as full_date
      FROM service_orders
      WHERE DATE(booking_date) = DATE('2025-12-30')
      AND status NOT IN ('cancelled', 'refunded')
    `);
    console.log('Dec 30 bookings with shop info:');
    console.log(JSON.stringify(result.rows, null, 2));

    // Test the exact query used by getBookedSlots
    const testQuery1 = await pool.query(`
      SELECT
        COALESCE(booking_time_slot, booking_time) as "timeSlot",
        COUNT(*) as count
      FROM service_orders
      WHERE shop_id = 'dc_shopu'
        AND booking_date = '2025-12-30'
        AND (booking_time_slot IS NOT NULL OR booking_time IS NOT NULL)
        AND status NOT IN ('cancelled', 'refunded')
      GROUP BY COALESCE(booking_time_slot, booking_time)
    `);
    console.log('\nTest query with string date (current behavior):');
    console.log(JSON.stringify(testQuery1.rows, null, 2));

    // Test with DATE() cast
    const testQuery2 = await pool.query(`
      SELECT
        COALESCE(booking_time_slot, booking_time) as "timeSlot",
        COUNT(*) as count
      FROM service_orders
      WHERE shop_id = 'dc_shopu'
        AND DATE(booking_date) = DATE('2025-12-30')
        AND (booking_time_slot IS NOT NULL OR booking_time IS NOT NULL)
        AND status NOT IN ('cancelled', 'refunded')
      GROUP BY COALESCE(booking_time_slot, booking_time)
    `);
    console.log('\nTest query with DATE() cast (proposed fix):');
    console.log(JSON.stringify(testQuery2.rows, null, 2));

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

check();
