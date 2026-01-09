// Debug script to check time slot generation
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function debugTimeSlots() {
  // Get today's date
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const dayOfWeek = today.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  console.log('=== Time Slot Debug ===');
  console.log(`Server time: ${today.toISOString()}`);
  console.log(`Server local: ${today.toString()}`);
  console.log(`Today's date string: ${dateStr}`);
  console.log(`Day of week: ${dayOfWeek} (${dayNames[dayOfWeek]})`);
  console.log(`Timezone offset: ${today.getTimezoneOffset()} minutes`);
  console.log('');

  try {
    // Find DC Shopuo shop (note: column is snake_case in DB)
    const shopResult = await pool.query(`
      SELECT shop_id, name FROM shops
      WHERE name ILIKE '%DC Shopuo%' OR name ILIKE '%shopuo%'
      LIMIT 1
    `);

    if (shopResult.rows.length === 0) {
      console.log('Shop not found. Listing all shops:');
      const allShops = await pool.query(`SELECT shop_id, name FROM shops LIMIT 10`);
      console.table(allShops.rows);
      return;
    }

    const shop = shopResult.rows[0];
    console.log(`Found shop: ${shop.name} (${shop.shop_id})`);
    console.log('');

    // Get time slot config
    const configResult = await pool.query(`
      SELECT * FROM shop_time_slot_config WHERE shop_id = $1
    `, [shop.shop_id]);

    console.log('=== Time Slot Config ===');
    if (configResult.rows.length > 0) {
      const config = configResult.rows[0];
      console.log(`Slot duration: ${config.slot_duration_minutes} minutes`);
      console.log(`Buffer time: ${config.buffer_time_minutes} minutes`);
      console.log(`Max concurrent: ${config.max_concurrent_bookings}`);
      console.log(`Booking advance days: ${config.booking_advance_days}`);
      console.log(`Min booking hours: ${config.min_booking_hours}`);
      console.log(`Allow weekend: ${config.allow_weekend_booking}`);
    } else {
      console.log('No config found!');
    }
    console.log('');

    // Get availability for today's day of week
    console.log('=== Shop Availability ===');
    const availResult = await pool.query(`
      SELECT day_of_week, is_open, open_time, close_time, break_start_time, break_end_time
      FROM shop_availability
      WHERE shop_id = $1
      ORDER BY day_of_week
    `, [shop.shop_id]);

    if (availResult.rows.length === 0) {
      console.log('No availability entries found!');
    } else {
      console.table(availResult.rows);

      const todayAvail = availResult.rows.find((a: any) => Number(a.day_of_week) === dayOfWeek);
      if (!todayAvail) {
        console.log(`\n!!! No availability entry for ${dayNames[dayOfWeek]} (day ${dayOfWeek})!`);
      } else {
        console.log(`\nToday (${dayNames[dayOfWeek]}): isOpen=${todayAvail.is_open}, hours=${todayAvail.open_time} - ${todayAvail.close_time}`);
      }
    }
    console.log('');

    // Check for date overrides for today
    console.log('=== Date Overrides (Today) ===');
    const overrideResult = await pool.query(`
      SELECT * FROM shop_date_overrides
      WHERE shop_id = $1 AND override_date = $2
    `, [shop.shop_id, dateStr]);

    if (overrideResult.rows.length > 0) {
      console.table(overrideResult.rows);
    } else {
      console.log('No override for today');
    }
    console.log('');

    // Check time calculations
    if (configResult.rows.length > 0 && availResult.rows.length > 0) {
      const config = configResult.rows[0];
      const todayAvail = availResult.rows.find((a: any) => Number(a.day_of_week) === dayOfWeek);

      if (todayAvail && todayAvail.is_open && todayAvail.open_time && todayAvail.close_time) {
        console.log('=== Time Calculations ===');

        // Parse open/close times
        const openTime = todayAvail.open_time.toString();
        const closeTime = todayAvail.close_time.toString();
        const [openHour, openMin] = openTime.split(':').map(Number);
        const [closeHour, closeMin] = closeTime.split(':').map(Number);

        console.log(`Open time: ${openTime} (${openHour}:${openMin})`);
        console.log(`Close time: ${closeTime} (${closeHour}:${closeMin})`);

        // Check if overnight
        const openMinutes = openHour * 60 + openMin;
        const closeMinutes = closeHour * 60 + closeMin;
        const isOvernight = closeMinutes <= openMinutes;
        console.log(`Is overnight: ${isOvernight}`);

        // Calculate first and last slot
        const [year, month, day] = dateStr.split('-').map(Number);
        const firstSlot = new Date(year, month - 1, day, openHour, openMin);
        let lastSlot = new Date(year, month - 1, day, closeHour, closeMin);

        if (isOvernight) {
          lastSlot = new Date(year, month - 1, day + 1, closeHour, closeMin);
        }

        console.log(`First slot: ${firstSlot.toString()}`);
        console.log(`Last slot: ${lastSlot.toString()}`);

        // Calculate hours until slots
        const hoursUntilFirstSlot = (firstSlot.getTime() - today.getTime()) / (1000 * 60 * 60);
        const hoursUntilLastSlot = (lastSlot.getTime() - today.getTime()) / (1000 * 60 * 60);

        console.log(`Hours until first slot: ${hoursUntilFirstSlot.toFixed(2)}`);
        console.log(`Hours until last slot: ${hoursUntilLastSlot.toFixed(2)}`);
        console.log(`Min booking hours: ${config.min_booking_hours}`);

        if (hoursUntilLastSlot < config.min_booking_hours) {
          console.log(`\n!!! ALL SLOTS REJECTED - last slot (${hoursUntilLastSlot.toFixed(2)} hours away) < minBookingHours (${config.min_booking_hours})`);
        } else if (hoursUntilFirstSlot < config.min_booking_hours) {
          console.log(`\n!!! Some early slots rejected - first slot ${hoursUntilFirstSlot.toFixed(2)} hours away < minBookingHours ${config.min_booking_hours}`);

          // Calculate how many slots would be available
          const minBookingTime = new Date(today.getTime() + config.min_booking_hours * 60 * 60 * 1000);
          console.log(`Minimum bookable time: ${minBookingTime.toString()}`);
        } else {
          console.log('\n✓ All slots should be available (timing-wise)');
        }
      }
    }

    // Now let's actually call the AppointmentService to see what it returns
    console.log('\n=== Testing AppointmentService ===');

    // Get a service ID from this shop
    const serviceResult = await pool.query(`
      SELECT service_id, service_name FROM shop_services
      WHERE shop_id = $1 AND active = true
      LIMIT 1
    `, [shop.shop_id]);

    if (serviceResult.rows.length === 0) {
      console.log('No active services found for shop');
    } else {
      const service = serviceResult.rows[0];
      console.log(`Testing with service: ${service.service_name} (${service.service_id})`);

      // Import and test the AppointmentService
      const { AppointmentService } = await import('../src/domains/ServiceDomain/services/AppointmentService');
      const appointmentService = new AppointmentService();

      try {
        console.log(`\nGetting time slots for ${dateStr}...`);
        const slots = await appointmentService.getAvailableTimeSlots(shop.shop_id, service.service_id, dateStr);
        console.log(`Total slots returned: ${slots.length}`);
        if (slots.length > 0) {
          console.log('First 5 slots:');
          slots.slice(0, 5).forEach(s => console.log(`  ${s.time} - available: ${s.available}`));
          if (slots.length > 5) {
            console.log(`  ... and ${slots.length - 5} more`);
          }
        } else {
          console.log('NO SLOTS RETURNED!');
        }

        // Also test for Dec 26 (Friday)
        console.log(`\nGetting time slots for 2025-12-26 (Friday)...`);
        const fridaySlots = await appointmentService.getAvailableTimeSlots(shop.shop_id, service.service_id, '2025-12-26');
        console.log(`Total slots returned: ${fridaySlots.length}`);
        if (fridaySlots.length > 0) {
          console.log('First 5 slots:');
          fridaySlots.slice(0, 5).forEach(s => console.log(`  ${s.time} - available: ${s.available}`));
        } else {
          console.log('NO SLOTS RETURNED!');
        }

      } catch (err: any) {
        console.error('Error calling AppointmentService:', err.message);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugTimeSlots();
