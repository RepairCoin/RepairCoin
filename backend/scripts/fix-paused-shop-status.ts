/**
 * Fix paused shop operational_status
 *
 * This script updates shops that have paused subscriptions but operational_status
 * was not updated to 'paused'.
 *
 * Usage: npx ts-node scripts/fix-paused-shop-status.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { getSharedPool } from '../src/utils/database-pool';

async function fixPausedShopStatus() {
  const pool = getSharedPool();

  try {
    // Find shops with paused subscriptions that don't have operational_status = 'paused'
    const result = await pool.query(`
      SELECT s.shop_id, s.name, s.operational_status, ss.status as subscription_status
      FROM shops s
      JOIN shop_subscriptions ss ON s.shop_id = ss.shop_id
      WHERE ss.status = 'paused'
        AND (s.operational_status IS NULL OR s.operational_status != 'paused')
    `);

    console.log(`Found ${result.rows.length} shops with paused subscriptions but wrong operational_status:`);

    for (const row of result.rows) {
      console.log(`- ${row.name} (${row.shop_id}): operational_status=${row.operational_status}, subscription_status=${row.subscription_status}`);

      // Update operational_status to 'paused'
      await pool.query(`
        UPDATE shops
        SET operational_status = 'paused', updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $1
      `, [row.shop_id]);

      console.log(`  -> Updated operational_status to 'paused'`);
    }

    console.log('\nDone!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixPausedShopStatus();
