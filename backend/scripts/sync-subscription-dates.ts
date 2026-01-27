/**
 * One-time migration script to sync shop_subscriptions.next_payment_date
 * with stripe_subscriptions.current_period_end
 *
 * This fixes the data discrepancy where these two tables were out of sync.
 * Run this once to fix existing data, then the app code changes will keep them in sync.
 */
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'repaircoin',
  password: process.env.DB_PASSWORD || 'repaircoin123',
  database: process.env.DB_NAME || 'repaircoin',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function syncSubscriptionDates() {
  console.log('='.repeat(70));
  console.log('SUBSCRIPTION DATE SYNC MIGRATION');
  console.log('Syncing shop_subscriptions.next_payment_date from stripe_subscriptions.current_period_end');
  console.log('='.repeat(70));

  try {
    // First, show current state before sync
    console.log('\n📊 BEFORE SYNC - Current state of subscriptions:');
    const beforeQuery = `
      SELECT
        ss.shop_id,
        s.name as shop_name,
        ss.next_payment_date as shop_sub_next_payment,
        str.current_period_end as stripe_period_end,
        ss.status as shop_sub_status,
        str.status as stripe_status
      FROM shop_subscriptions ss
      JOIN shops s ON s.shop_id = ss.shop_id
      LEFT JOIN (
        SELECT DISTINCT ON (shop_id) *
        FROM stripe_subscriptions
        ORDER BY shop_id, created_at DESC
      ) str ON str.shop_id = ss.shop_id
      WHERE str.current_period_end IS NOT NULL
      ORDER BY ss.shop_id
    `;

    const beforeResult = await pool.query(beforeQuery);

    if (beforeResult.rows.length === 0) {
      console.log('  No subscriptions found to sync.');
      await pool.end();
      return;
    }

    console.log(`  Found ${beforeResult.rows.length} subscriptions:\n`);

    let needsSync = 0;
    beforeResult.rows.forEach(row => {
      const shopNext = row.shop_sub_next_payment ? new Date(row.shop_sub_next_payment).toISOString().split('T')[0] : 'NULL';
      const stripeEnd = row.stripe_period_end ? new Date(row.stripe_period_end).toISOString().split('T')[0] : 'NULL';
      const match = shopNext === stripeEnd ? '✅' : '❌';

      if (shopNext !== stripeEnd) needsSync++;

      console.log(`  ${match} ${row.shop_name} (${row.shop_id})`);
      console.log(`     shop_sub.next_payment_date: ${shopNext}`);
      console.log(`     stripe.current_period_end:  ${stripeEnd}`);
      console.log('');
    });

    if (needsSync === 0) {
      console.log('✅ All subscriptions are already in sync! No action needed.');
      await pool.end();
      return;
    }

    console.log(`\n⚠️  ${needsSync} subscription(s) need to be synced.`);
    console.log('\n🔄 Running sync update...\n');

    // Perform the sync
    const syncQuery = `
      UPDATE shop_subscriptions ss
      SET
        next_payment_date = str.current_period_end,
        updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT DISTINCT ON (shop_id) shop_id, current_period_end
        FROM stripe_subscriptions
        WHERE current_period_end IS NOT NULL
        ORDER BY shop_id, created_at DESC
      ) str
      WHERE ss.shop_id = str.shop_id
        AND ss.status IN ('active', 'cancelled')
        AND (ss.next_payment_date IS DISTINCT FROM str.current_period_end)
      RETURNING ss.shop_id, ss.next_payment_date as new_next_payment
    `;

    const syncResult = await pool.query(syncQuery);

    console.log(`✅ Synced ${syncResult.rowCount} subscription(s).\n`);

    // Show after state
    console.log('📊 AFTER SYNC - Updated subscriptions:');
    syncResult.rows.forEach(row => {
      console.log(`  ✅ ${row.shop_id}: next_payment_date = ${new Date(row.new_next_payment).toISOString()}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('SYNC COMPLETE');
    console.log('='.repeat(70));

    await pool.end();

  } catch (error) {
    console.error('❌ Error during sync:', error);
    await pool.end();
    process.exit(1);
  }
}

syncSubscriptionDates();
