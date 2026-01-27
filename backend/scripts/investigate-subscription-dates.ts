/**
 * Investigation Script: Why are Admin and Shop showing different Next Payment Dates?
 *
 * Admin shows: 1/30/2026
 * Shop shows: 2/12/2026
 *
 * This script investigates the discrepancy by:
 * 1. Checking the database tables for both values
 * 2. Identifying which tables store what data
 * 3. Showing the data flow in the codebase
 */

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function investigateSubscriptionDates() {
  console.log('\n========================================');
  console.log('SUBSCRIPTION DATE INVESTIGATION');
  console.log('========================================\n');

  try {
    // 1. Get DC Shopuo's shop_id
    console.log('1. Finding DC Shopuo shop...\n');
    const shopResult = await pool.query(`
      SELECT shop_id, name, wallet_address
      FROM shops
      WHERE LOWER(name) LIKE '%dc shop%' OR LOWER(name) LIKE '%shopuo%'
    `);

    if (shopResult.rows.length === 0) {
      console.log('Shop not found. Listing all active shops...');
      const allShops = await pool.query(`SELECT shop_id, name FROM shops WHERE is_active = true LIMIT 10`);
      console.table(allShops.rows);
      return;
    }

    const shop = shopResult.rows[0];
    console.log(`Found shop: ${shop.name} (${shop.shop_id})\n`);

    // 2. Check shop_subscriptions table (used by Admin view)
    console.log('----------------------------------------');
    console.log('2. ADMIN VIEW DATA SOURCE: shop_subscriptions');
    console.log('----------------------------------------\n');

    const shopSubResult = await pool.query(`
      SELECT
        id,
        shop_id,
        status,
        next_payment_date,
        last_payment_date,
        enrolled_at,
        activated_at,
        updated_at
      FROM shop_subscriptions
      WHERE shop_id = $1
      ORDER BY enrolled_at DESC
      LIMIT 1
    `, [shop.shop_id]);

    if (shopSubResult.rows.length > 0) {
      const shopSub = shopSubResult.rows[0];
      console.log('shop_subscriptions record:');
      console.log(`  - ID: ${shopSub.id}`);
      console.log(`  - Status: ${shopSub.status}`);
      console.log(`  - next_payment_date: ${shopSub.next_payment_date}`);
      console.log(`  - last_payment_date: ${shopSub.last_payment_date}`);
      console.log(`  - enrolled_at: ${shopSub.enrolled_at}`);
      console.log(`  - activated_at: ${shopSub.activated_at}`);
      console.log(`  - updated_at: ${shopSub.updated_at}`);

      if (shopSub.next_payment_date) {
        const nextPaymentFormatted = new Date(shopSub.next_payment_date).toLocaleDateString('en-US');
        console.log(`\n  >> ADMIN shows this date: ${nextPaymentFormatted}`);
      }
    } else {
      console.log('No shop_subscriptions record found!');
    }

    // 3. Check stripe_subscriptions table (used by Shop view)
    console.log('\n----------------------------------------');
    console.log('3. SHOP VIEW DATA SOURCE: stripe_subscriptions');
    console.log('----------------------------------------\n');

    const stripeSubResult = await pool.query(`
      SELECT
        id,
        shop_id,
        stripe_subscription_id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        created_at,
        updated_at
      FROM stripe_subscriptions
      WHERE shop_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [shop.shop_id]);

    if (stripeSubResult.rows.length > 0) {
      const stripeSub = stripeSubResult.rows[0];
      console.log('stripe_subscriptions record:');
      console.log(`  - ID: ${stripeSub.id}`);
      console.log(`  - stripe_subscription_id: ${stripeSub.stripe_subscription_id}`);
      console.log(`  - Status: ${stripeSub.status}`);
      console.log(`  - current_period_start: ${stripeSub.current_period_start}`);
      console.log(`  - current_period_end: ${stripeSub.current_period_end}`);
      console.log(`  - cancel_at_period_end: ${stripeSub.cancel_at_period_end}`);
      console.log(`  - created_at: ${stripeSub.created_at}`);
      console.log(`  - updated_at: ${stripeSub.updated_at}`);

      if (stripeSub.current_period_end) {
        const periodEndFormatted = new Date(stripeSub.current_period_end).toLocaleDateString('en-US');
        console.log(`\n  >> SHOP shows this date: ${periodEndFormatted}`);
      }
    } else {
      console.log('No stripe_subscriptions record found!');
    }

    // 4. Compare the dates
    console.log('\n========================================');
    console.log('4. DATE COMPARISON');
    console.log('========================================\n');

    if (shopSubResult.rows.length > 0 && stripeSubResult.rows.length > 0) {
      const shopNextPayment = shopSubResult.rows[0].next_payment_date;
      const stripeCurrentPeriodEnd = stripeSubResult.rows[0].current_period_end;

      const shopDate = shopNextPayment ? new Date(shopNextPayment) : null;
      const stripeDate = stripeCurrentPeriodEnd ? new Date(stripeCurrentPeriodEnd) : null;

      console.log(`shop_subscriptions.next_payment_date: ${shopDate?.toISOString() || 'NULL'}`);
      console.log(`stripe_subscriptions.current_period_end: ${stripeDate?.toISOString() || 'NULL'}`);

      if (shopDate && stripeDate) {
        const diffMs = stripeDate.getTime() - shopDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        console.log(`\nDifference: ${diffDays} days`);

        if (diffDays !== 0) {
          console.log('\n!! DATES ARE OUT OF SYNC !!');
          console.log('\nPossible causes:');
          console.log('  1. shop_subscriptions.next_payment_date was not updated after Stripe renewal');
          console.log('  2. syncNextPaymentDateFromStripe() was not called');
          console.log('  3. The sync failed silently');
        }
      }
    }

    // 5. Check the code paths
    console.log('\n========================================');
    console.log('5. CODE PATH ANALYSIS');
    console.log('========================================\n');

    console.log('ADMIN VIEW (backend/src/domains/admin/routes/subscription.ts):');
    console.log('  - Line 81: nextPaymentDate: row.next_payment_date');
    console.log('  - Source: shop_subscriptions table');
    console.log('  - Also fetches stripe_period_end but doesnt use it for nextPaymentDate');

    console.log('\nSHOP VIEW (backend/src/domains/shop/routes/subscription.ts):');
    console.log('  - Line 223: nextPaymentDate: new Date(stripeSubscription.currentPeriodEnd).toISOString()');
    console.log('  - Source: stripe_subscriptions table (via SubscriptionService)');

    console.log('\nSYNC MECHANISM (ShopSubscriptionRepository.syncNextPaymentDateFromStripe):');
    console.log('  - Should sync shop_subscriptions.next_payment_date with Stripe current_period_end');
    console.log('  - Called from:');
    console.log('    1. SubscriptionService.ts:146 (on subscription creation)');
    console.log('    2. SubscriptionService.ts:585 (on sync from Stripe)');
    console.log('    3. SubscriptionService.ts:700 (on update)');
    console.log('    4. webhooks.ts:931 (on webhook events)');

    // 6. Check when shop_subscriptions was last updated
    console.log('\n========================================');
    console.log('6. UPDATE TIMELINE');
    console.log('========================================\n');

    if (shopSubResult.rows.length > 0 && stripeSubResult.rows.length > 0) {
      console.log(`shop_subscriptions.updated_at: ${shopSubResult.rows[0].updated_at}`);
      console.log(`stripe_subscriptions.updated_at: ${stripeSubResult.rows[0].updated_at}`);

      const shopUpdated = new Date(shopSubResult.rows[0].updated_at);
      const stripeUpdated = new Date(stripeSubResult.rows[0].updated_at);

      if (stripeUpdated > shopUpdated) {
        console.log('\n!! stripe_subscriptions was updated more recently than shop_subscriptions !!');
        console.log('This suggests the sync did NOT run after the Stripe update.');
      }
    }

    // 7. ROOT CAUSE IDENTIFIED
    console.log('\n========================================');
    console.log('7. ROOT CAUSE IDENTIFIED');
    console.log('========================================\n');

    console.log('BUG LOCATION: webhooks.ts handlePaymentSucceeded() function (lines 607-641)');
    console.log('\nWhen invoice.payment_succeeded fires (subscription renewal):');
    console.log('  - It only logs the event');
    console.log('  - It only publishes to EventBus');
    console.log('  - It does NOT call updateSubscriptionInDatabase()');
    console.log('  - It does NOT call syncNextPaymentDateFromStripe()');
    console.log('\nThis means when Stripe renews the subscription and updates current_period_end,');
    console.log('the shop_subscriptions.next_payment_date is NEVER updated!');

    console.log('\n========================================');
    console.log('8. RECOMMENDED FIX');
    console.log('========================================\n');

    console.log('Fix handlePaymentSucceeded() to:');
    console.log('  1. Fetch the subscription from Stripe using subscriptionId');
    console.log('  2. Call updateSubscriptionInDatabase(subscription)');
    console.log('  3. This will trigger syncNextPaymentDateFromStripe()');
    console.log('\nAlternatively:');
    console.log('  - Directly call syncNextPaymentDateFromStripe after payment');
    console.log('  - Or rely on customer.subscription.updated webhook (but may have timing issues)');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

investigateSubscriptionDates();
