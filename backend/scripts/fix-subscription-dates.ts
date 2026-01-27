/**
 * Fix subscription dates from Stripe items.data[0]
 *
 * This script updates the database with the correct period dates from Stripe.
 * In newer Stripe API versions, current_period_start/end are in items.data[0]
 * instead of directly on the subscription object.
 */

import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import Stripe from 'stripe';

dotenv.config();

const SHOP_ID = 'dc_shopu';
const SUBSCRIPTION_ID = 'sub_1SWscNL8hwPnzzXkX4QQooOJ';  // Latest active subscription

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function fixSubscriptionDates() {
  console.log('\n========================================');
  console.log('FIX SUBSCRIPTION DATES');
  console.log('========================================\n');

  try {
    // 1. Get current DB values for the specific subscription
    const subResult = await pool.query(
      'SELECT stripe_subscription_id, current_period_start, current_period_end FROM stripe_subscriptions WHERE stripe_subscription_id = $1',
      [SUBSCRIPTION_ID]
    );

    if (subResult.rows.length === 0) {
      console.log('No subscription found for ID:', SUBSCRIPTION_ID);
      return;
    }

    const dbSub = subResult.rows[0];
    console.log('Current DB values:');
    console.log('  current_period_start:', dbSub.current_period_start);
    console.log('  current_period_end:', dbSub.current_period_end);

    // 2. Get correct values from Stripe items.data[0]
    const stripeSub = await stripe.subscriptions.retrieve(dbSub.stripe_subscription_id);
    const firstItem = stripeSub.items?.data?.[0];

    if (!firstItem) {
      console.log('No items found in Stripe subscription');
      return;
    }

    const correctStart = (firstItem as any).current_period_start;
    const correctEnd = (firstItem as any).current_period_end;

    console.log('\nCorrect values from Stripe items.data[0]:');
    console.log('  current_period_start:', new Date(correctStart * 1000).toISOString());
    console.log('  current_period_end:', new Date(correctEnd * 1000).toISOString());

    // 3. Update stripe_subscriptions table
    await pool.query(
      `UPDATE stripe_subscriptions
       SET current_period_start = $1,
           current_period_end = $2,
           updated_at = NOW()
       WHERE stripe_subscription_id = $3`,
      [new Date(correctStart * 1000), new Date(correctEnd * 1000), SUBSCRIPTION_ID]
    );

    // 4. Update shop_subscriptions table
    await pool.query(
      `UPDATE shop_subscriptions
       SET next_payment_date = $1,
           updated_at = NOW()
       WHERE shop_id = $2`,
      [new Date(correctEnd * 1000), SHOP_ID]
    );

    console.log('\n✅ Database updated successfully!');

    // 5. Verify
    const verifyResult = await pool.query(
      'SELECT current_period_start, current_period_end FROM stripe_subscriptions WHERE stripe_subscription_id = $1',
      [SUBSCRIPTION_ID]
    );
    const shopSubResult = await pool.query(
      'SELECT next_payment_date FROM shop_subscriptions WHERE shop_id = $1',
      [SHOP_ID]
    );

    console.log('\nNew DB values:');
    console.log('  stripe_subscriptions.current_period_start:', verifyResult.rows[0].current_period_start);
    console.log('  stripe_subscriptions.current_period_end:', verifyResult.rows[0].current_period_end);
    console.log('  shop_subscriptions.next_payment_date:', shopSubResult.rows[0].next_payment_date);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixSubscriptionDates();
