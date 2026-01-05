// Check shop availability for a specific service
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

async function check() {
  try {
    // Find service "BOXING TRAINING FOR KIDS"
    const services = await pool.query(`
      SELECT ss.service_id, ss.service_name, ss.shop_id, s.name as shop_name
      FROM shop_services ss
      JOIN shops s ON ss.shop_id = s.shop_id
      WHERE ss.service_name ILIKE '%boxing%' OR ss.service_name ILIKE '%training%'
      LIMIT 5
    `);

    console.log('=== Services matching "boxing/training" ===');
    console.table(services.rows);

    if (services.rows.length > 0) {
      for (const svc of services.rows) {
        console.log(`\n=== Availability for shop: ${svc.shop_name} (${svc.shop_id}) ===`);

        const avail = await pool.query(`
          SELECT day_of_week, is_open, open_time, close_time
          FROM shop_availability
          WHERE shop_id = $1
          ORDER BY day_of_week
        `, [svc.shop_id]);

        if (avail.rows.length === 0) {
          console.log('!!! NO AVAILABILITY CONFIGURED !!!');
        } else {
          console.table(avail.rows);
        }

        // Check time slot config
        const config = await pool.query(`
          SELECT booking_advance_days, min_booking_hours
          FROM shop_time_slot_config
          WHERE shop_id = $1
        `, [svc.shop_id]);

        if (config.rows.length === 0) {
          console.log('!!! NO TIME SLOT CONFIG !!!');
        } else {
          console.log('Time slot config:', config.rows[0]);
        }
      }
    }

    // Also check shops named "Deo Testing Shop"
    console.log('\n=== Shops with "Deo" or "Testing" in name ===');
    const shops = await pool.query(`
      SELECT shop_id, name FROM shops WHERE name ILIKE '%deo%' OR name ILIKE '%testing%' LIMIT 5
    `);
    console.table(shops.rows);

    for (const shop of shops.rows) {
      const avail = await pool.query(`
        SELECT day_of_week, is_open, open_time, close_time
        FROM shop_availability
        WHERE shop_id = $1
        ORDER BY day_of_week
      `, [shop.shop_id]);

      console.log(`\nAvailability for ${shop.name}:`);
      if (avail.rows.length === 0) {
        console.log('!!! NO AVAILABILITY CONFIGURED !!!');
      } else {
        console.table(avail.rows);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

check();
