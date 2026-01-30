/**
 * Debug script to check shop configuration from database
 */
import { getSharedPool } from '../src/utils/database-pool';
const pool = getSharedPool();

async function debugShopConfig() {
  try {
    // Get all shops with their time slot configs
    const configResult = await pool.query(`
      SELECT
        s.shop_id,
        s.business_name,
        stc.timezone,
        stc.min_booking_hours,
        stc.booking_advance_days,
        stc.slot_duration_minutes,
        stc.allow_weekend_booking
      FROM shops s
      LEFT JOIN shop_time_slot_config stc ON s.shop_id = stc.shop_id
      WHERE s.is_active = true
      LIMIT 5
    `);

    console.log('=== SHOP TIME SLOT CONFIGS ===');
    configResult.rows.forEach((row: any) => {
      console.log('\nShop:', row.business_name);
      console.log('  Shop ID:', row.shop_id);
      console.log('  Timezone:', row.timezone || 'NOT SET (will use America/New_York)');
      console.log('  Min booking hours:', row.min_booking_hours);
      console.log('  Booking advance days:', row.booking_advance_days);
      console.log('  Allow weekend:', row.allow_weekend_booking);
    });

    // Get shop availability for each day
    if (configResult.rows.length > 0) {
      const shopId = configResult.rows[0].shop_id;
      console.log('\n=== SHOP AVAILABILITY FOR', configResult.rows[0].business_name, '===');

      const availResult = await pool.query(`
        SELECT
          day_of_week,
          is_open,
          open_time,
          close_time,
          break_start_time,
          break_end_time
        FROM shop_availability
        WHERE shop_id = $1
        ORDER BY day_of_week
      `, [shopId]);

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      availResult.rows.forEach((row: any) => {
        const dayName = days[row.day_of_week];
        if (row.is_open) {
          console.log(dayName + ': ' + row.open_time + ' - ' + row.close_time);
          if (row.break_start_time) {
            console.log('  Break: ' + row.break_start_time + ' - ' + row.break_end_time);
          }
        } else {
          console.log(dayName + ': CLOSED');
        }
      });

      // Check today's date in different timezones
      const now = new Date();
      console.log('\n=== DATE CHECK ===');
      console.log('UTC now:', now.toISOString());

      // Get today in shop timezone
      const shopTzFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: configResult.rows[0].timezone || 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const shopToday = shopTzFormatter.format(now);
      console.log('Today in shop timezone:', shopToday);

      // Get day of week
      const shopDayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: configResult.rows[0].timezone || 'America/New_York',
        weekday: 'long'
      });
      console.log('Day of week in shop timezone:', shopDayFormatter.format(now));

      // User timezone (Philippines)
      const userTzFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const userToday = userTzFormatter.format(now);
      console.log('Today in user timezone (Philippines):', userToday);

      const userDayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'long'
      });
      console.log('Day of week in user timezone:', userDayFormatter.format(now));
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

debugShopConfig();
