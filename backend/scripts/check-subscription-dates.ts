/**
 * Check subscription dates for investigation
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

async function checkDates() {
  console.log('='.repeat(70));
  console.log('SUBSCRIPTION DATE INVESTIGATION');
  console.log('='.repeat(70));

  try {
    // Check all stripe_subscriptions for dc_shopu
    console.log('\n📋 ALL stripe_subscriptions for dc_shopu:');
    const stripeQuery = `
      SELECT
        id,
        shop_id,
        stripe_subscription_id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        canceled_at,
        created_at
      FROM stripe_subscriptions
      WHERE shop_id = 'dc_shopu'
      ORDER BY created_at DESC
    `;
    const stripeResult = await pool.query(stripeQuery);

    stripeResult.rows.forEach((row, i) => {
      console.log(`\n  [${i + 1}] Stripe Subscription:`);
      console.log(`      ID: ${row.id}`);
      console.log(`      stripe_subscription_id: ${row.stripe_subscription_id}`);
      console.log(`      status: ${row.status}`);
      console.log(`      current_period_start: ${row.current_period_start}`);
      console.log(`      current_period_end: ${row.current_period_end}`);
      console.log(`      cancel_at_period_end: ${row.cancel_at_period_end}`);
      console.log(`      canceled_at: ${row.canceled_at}`);
      console.log(`      created_at: ${row.created_at}`);
    });

    // Check shop_subscriptions for dc_shopu
    console.log('\n📋 ALL shop_subscriptions for dc_shopu:');
    const shopSubQuery = `
      SELECT
        id,
        shop_id,
        status,
        next_payment_date,
        last_payment_date,
        cancelled_at,
        cancellation_reason,
        created_at
      FROM shop_subscriptions
      WHERE shop_id = 'dc_shopu'
      ORDER BY created_at DESC
    `;
    const shopSubResult = await pool.query(shopSubQuery);

    shopSubResult.rows.forEach((row, i) => {
      console.log(`\n  [${i + 1}] Shop Subscription:`);
      console.log(`      ID: ${row.id}`);
      console.log(`      status: ${row.status}`);
      console.log(`      next_payment_date: ${row.next_payment_date}`);
      console.log(`      last_payment_date: ${row.last_payment_date}`);
      console.log(`      cancelled_at: ${row.cancelled_at}`);
      console.log(`      cancellation_reason: ${row.cancellation_reason}`);
    });

    // Check ALL stripe subscriptions to see which one has 2026-01-31
    console.log('\n\n📋 SEARCH: Which subscription has current_period_end around 2026-01-31?');
    const searchQuery = `
      SELECT
        shop_id,
        stripe_subscription_id,
        status,
        current_period_end
      FROM stripe_subscriptions
      WHERE current_period_end BETWEEN '2026-01-30' AND '2026-02-01'
      ORDER BY current_period_end
    `;
    const searchResult = await pool.query(searchQuery);

    if (searchResult.rows.length > 0) {
      searchResult.rows.forEach(row => {
        console.log(`  ${row.shop_id}: ${row.current_period_end} (${row.status})`);
      });
    } else {
      console.log('  No subscriptions found with that date range');
    }

    console.log('\n' + '='.repeat(70));
    await pool.end();

  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkDates();
