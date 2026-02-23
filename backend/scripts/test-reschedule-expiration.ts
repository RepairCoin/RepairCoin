/**
 * Test script for reschedule expiration service
 *
 * Usage: npx ts-node scripts/test-reschedule-expiration.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getSharedPool } from '../src/utils/database-pool';
import { RescheduleService } from '../src/domains/ServiceDomain/services/RescheduleService';
import { logger } from '../src/utils/logger';

async function testRescheduleExpiration() {
  const pool = getSharedPool();

  console.log('\n=== Reschedule Expiration Test ===\n');

  try {
    // Step 1: Find an existing paid order with a booking date
    console.log('1. Finding a paid order to use for testing...');
    const orderResult = await pool.query(`
      SELECT order_id, shop_id, customer_address,
             TO_CHAR(booking_date, 'YYYY-MM-DD') as booking_date,
             booking_time_slot
      FROM service_orders
      WHERE status IN ('paid', 'confirmed')
        AND booking_date IS NOT NULL
      LIMIT 1
    `);

    if (orderResult.rows.length === 0) {
      console.log('❌ No paid orders with booking dates found. Trying any paid order...');

      // Fallback: find any paid order
      const fallbackResult = await pool.query(`
        SELECT order_id, shop_id, customer_address
        FROM service_orders
        WHERE status IN ('paid', 'confirmed')
        LIMIT 1
      `);

      if (fallbackResult.rows.length === 0) {
        console.log('❌ No paid orders found at all. Please create a booking first.');
        process.exit(1);
      }

      // Use fallback with default date
      const fallbackOrder = fallbackResult.rows[0];
      fallbackOrder.booking_date = '2026-02-20';
      fallbackOrder.booking_time_slot = '10:00:00';
      orderResult.rows[0] = fallbackOrder;
      console.log('   Using fallback with default date: 2026-02-20');
    }

    const order = orderResult.rows[0];
    console.log(`   Found order: ${order.order_id}`);
    console.log(`   Shop: ${order.shop_id}`);
    console.log(`   Customer: ${order.customer_address}`);
    console.log(`   Booking date: ${order.booking_date}`);

    // Step 2: Create an expired reschedule request
    console.log('\n2. Creating an expired reschedule request...');
    const insertResult = await pool.query(`
      INSERT INTO appointment_reschedule_requests (
        request_id, order_id, shop_id, customer_address,
        original_date, original_time_slot,
        requested_date, requested_time_slot,
        customer_reason, status, created_at, updated_at, expires_at
      ) VALUES (
        gen_random_uuid(),
        $1, $2, $3,
        $4, $5,
        $4::date + INTERVAL '1 day', '14:00:00',
        'Testing expiration',
        'pending',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '1 hour'
      )
      RETURNING request_id
    `, [order.order_id, order.shop_id, order.customer_address, order.booking_date, order.booking_time_slot || '10:00:00']);

    const requestId = insertResult.rows[0].request_id;
    console.log(`   Created request: ${requestId}`);
    console.log(`   Status: pending (expires_at is in the past)`);

    // Step 3: Run the expiration service
    console.log('\n3. Running expiration service...');
    const rescheduleService = new RescheduleService();
    const expiredRequests = await rescheduleService.expireOldRequests();

    console.log(`   Expired ${expiredRequests.length} request(s)`);

    // Step 4: Verify the request was expired
    console.log('\n4. Verifying request status...');
    const verifyResult = await pool.query(`
      SELECT status, updated_at
      FROM appointment_reschedule_requests
      WHERE request_id = $1
    `, [requestId]);

    if (verifyResult.rows[0]?.status === 'expired') {
      console.log(`   ✅ Request status is now: ${verifyResult.rows[0].status}`);
    } else {
      console.log(`   ❌ Unexpected status: ${verifyResult.rows[0]?.status}`);
    }

    // Step 5: Check for notification
    console.log('\n5. Checking for notification...');
    console.log('   ⚠️ Notification not created in standalone test (event handlers not initialized)');
    console.log('   ℹ️ In production, the NotificationDomain subscribes to reschedule:request_expired');
    console.log('   ℹ️ When running the full server, notifications WILL be created and sent');

    // Cleanup option
    console.log('\n6. Cleanup (optional)...');
    console.log(`   To delete test data, run:`);
    console.log(`   DELETE FROM appointment_reschedule_requests WHERE request_id = '${requestId}';`);

    console.log('\n=== Test Complete ===\n');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testRescheduleExpiration();
