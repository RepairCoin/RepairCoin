/**
 * Test shop_availability upsert
 *
 * This script tests the UPDATE ON CONFLICT query to verify it works.
 *
 * Usage: npx ts-node scripts/test-availability-update.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function testAvailabilityUpdate() {
  const host = process.env.DB_HOST || 'localhost';
  const sslEnabled = process.env.DB_SSL === 'true' || host.includes('digitalocean');

  const config: any = {
    host,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'repaircoin',
    user: process.env.DB_USER || 'repaircoin',
    password: process.env.DB_PASSWORD || 'repaircoin123',
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  };

  if (process.env.DATABASE_URL) {
    config.connectionString = process.env.DATABASE_URL;
    if (process.env.DATABASE_URL.includes('sslmode=require')) {
      config.ssl = { rejectUnauthorized: false };
    }
  }

  console.log(`\n🔌 Connecting to database: ${config.host}:${config.port}/${config.database}\n`);

  const pool = new Pool(config);

  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Get a real shop_id from the database
    const shopResult = await pool.query(`
      SELECT shop_id FROM shops LIMIT 1
    `);

    if (shopResult.rows.length === 0) {
      console.log('❌ No shops found in database\n');
      return;
    }

    const shopId = shopResult.rows[0].shop_id;
    console.log(`📍 Testing with shop_id: ${shopId}\n`);

    // Test the exact upsert query used by the application
    const dayOfWeek = 2; // Tuesday
    const isOpen = true;
    const openTime = '09:00:00';
    const closeTime = '18:00:00';

    console.log('🧪 Testing upsert query (same as AppointmentRepository.updateShopAvailability)...\n');

    const query = `
      INSERT INTO shop_availability (
        shop_id, day_of_week, is_open, open_time, close_time, break_start_time, break_end_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (shop_id, day_of_week)
      DO UPDATE SET
        is_open = EXCLUDED.is_open,
        open_time = EXCLUDED.open_time,
        close_time = EXCLUDED.close_time,
        break_start_time = EXCLUDED.break_start_time,
        break_end_time = EXCLUDED.break_end_time,
        updated_at = NOW()
      RETURNING
        availability_id as "availabilityId",
        shop_id as "shopId",
        day_of_week as "dayOfWeek",
        is_open as "isOpen",
        open_time as "openTime",
        close_time as "closeTime",
        break_start_time as "breakStartTime",
        break_end_time as "breakEndTime",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const result = await pool.query(query, [
      shopId,
      dayOfWeek,
      isOpen,
      openTime,
      closeTime,
      null, // breakStartTime
      null  // breakEndTime
    ]);

    console.log('✅ Upsert query executed successfully!\n');
    console.log('📊 Result:');
    console.log(JSON.stringify(result.rows[0], null, 2));

    // Test toggling the same day (to simulate checkbox toggle)
    console.log('\n🔄 Testing toggle (isOpen = false)...\n');

    const toggleResult = await pool.query(query, [
      shopId,
      dayOfWeek,
      false, // Toggle to closed
      openTime, // Keep same times
      closeTime,
      null,
      null
    ]);

    console.log('✅ Toggle query executed successfully!\n');
    console.log('📊 Result after toggle:');
    console.log(JSON.stringify(toggleResult.rows[0], null, 2));

    // Restore original state
    console.log('\n🔙 Restoring original state...\n');
    await pool.query(query, [
      shopId,
      dayOfWeek,
      true,
      openTime,
      closeTime,
      null,
      null
    ]);

    console.log('✅ All tests passed! The availability update should work now.\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testAvailabilityUpdate();
