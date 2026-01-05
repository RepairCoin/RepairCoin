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
    // Check bookings for Dec 30
    const result = await pool.query(`
      SELECT order_id, shop_id, service_id, customer_address, booking_date, booking_time_slot, status
      FROM service_orders
      WHERE booking_date = '2025-12-30'
      AND status NOT IN ('cancelled', 'refunded')
    `);
    console.log('Bookings for Dec 30:');
    console.log(JSON.stringify(result.rows, null, 2));

    // Check the shop_id for service 20
    const svc = await pool.query(`
      SELECT service_id, shop_id, service_name
      FROM shop_services
      WHERE service_name LIKE '%service 20%' OR service_name = 'service 20'
      LIMIT 5
    `);
    console.log('\nService 20 info:');
    console.log(JSON.stringify(svc.rows, null, 2));

    // Check time slot config for the shop
    if (svc.rows.length > 0) {
      const shopId = svc.rows[0].shop_id;
      const config = await pool.query(`
        SELECT * FROM shop_time_slot_config WHERE shop_id = $1
      `, [shopId]);
      console.log('\nTime slot config:');
      console.log(JSON.stringify(config.rows, null, 2));
    }

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

check();
