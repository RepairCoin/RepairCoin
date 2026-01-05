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

// This simulates the fixed getBookedSlots query
async function getBookedSlots(shopId: string, date: string) {
  const query = `
    SELECT
      COALESCE(booking_time_slot, booking_time) as "timeSlot",
      COUNT(*) as count
    FROM service_orders
    WHERE shop_id = $1
      AND DATE(booking_date) = DATE($2)
      AND (booking_time_slot IS NOT NULL OR booking_time IS NOT NULL)
      AND status NOT IN ('cancelled', 'refunded')
    GROUP BY COALESCE(booking_time_slot, booking_time)
    ORDER BY COALESCE(booking_time_slot, booking_time)
  `;

  const result = await pool.query(query, [shopId, date]);
  return result.rows.map(row => ({
    timeSlot: row.timeSlot,
    count: parseInt(row.count)
  }));
}

function normalizeTimeSlot(time: string): string {
  const parts = time.split(':');
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

async function verify() {
  try {
    console.log('=== VERIFYING BUG-020 FIX ===\n');

    // Get the shop config
    const config = await pool.query(`
      SELECT max_concurrent_bookings FROM shop_time_slot_config WHERE shop_id = 'dc_shopu'
    `);
    const maxConcurrent = config.rows[0]?.max_concurrent_bookings || 1;
    console.log(`Shop dc_shopu max_concurrent_bookings: ${maxConcurrent}`);

    // Get booked slots for Dec 30 using the FIXED query
    const bookedSlots = await getBookedSlots('dc_shopu', '2025-12-30');
    console.log(`\nBooked slots for Dec 30 (using fixed query):`);
    console.log(JSON.stringify(bookedSlots, null, 2));

    // Simulate checking if 09:00 is available
    const requestedTime = '09:00';
    const normalizedRequestTime = normalizeTimeSlot(requestedTime);
    const bookedCount = bookedSlots.find(slot => normalizeTimeSlot(slot.timeSlot) === normalizedRequestTime)?.count || 0;

    console.log(`\nValidation for time slot ${requestedTime}:`);
    console.log(`  - Normalized request time: ${normalizedRequestTime}`);
    console.log(`  - Booked count: ${bookedCount}`);
    console.log(`  - Max concurrent: ${maxConcurrent}`);
    console.log(`  - Is available: ${bookedCount < maxConcurrent}`);

    if (bookedCount >= maxConcurrent) {
      console.log(`\n✅ FIX VERIFIED: Time slot ${requestedTime} correctly shows as UNAVAILABLE`);
      console.log('   (bookedCount >= maxConcurrent, so new booking should be rejected)');
    } else {
      console.log(`\n❌ FIX NOT WORKING: Time slot ${requestedTime} still shows as available`);
      console.log('   Something is wrong - there should be at least 1 booking at 09:00');
    }

    // Also check 10:00 which should be available
    const tenAm = '10:00';
    const bookedCount10 = bookedSlots.find(slot => normalizeTimeSlot(slot.timeSlot) === normalizeTimeSlot(tenAm))?.count || 0;
    console.log(`\n10:00 AM slot:`);
    console.log(`  - Booked count: ${bookedCount10}`);
    console.log(`  - Is available: ${bookedCount10 < maxConcurrent}`);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

verify();
