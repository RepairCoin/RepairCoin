/**
 * Check subscription dates for a specific wallet address
 */

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const WALLET_ADDRESS = '0x42be8b92a770eb5eb97b7abe7a06183952ec5eb0';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function checkSubscriptionDates() {
  console.log('\n========================================');
  console.log('SUBSCRIPTION DATE CHECK');
  console.log('Wallet:', WALLET_ADDRESS);
  console.log('Today:', new Date().toISOString());
  console.log('========================================\n');

  try {
    // 1. Find the shop
    const shopResult = await pool.query(`
      SELECT shop_id, name, wallet_address, operational_status
      FROM shops
      WHERE LOWER(wallet_address) = LOWER($1)
    `, [WALLET_ADDRESS]);

    if (shopResult.rows.length === 0) {
      console.log('Shop not found for wallet:', WALLET_ADDRESS);
      return;
    }

    const shop = shopResult.rows[0];
    console.log('Shop found:');
    console.log(`  - Name: ${shop.name}`);
    console.log(`  - ID: ${shop.shop_id}`);
    console.log(`  - Status: ${shop.operational_status}\n`);

    // 2. Check shop_subscriptions table
    console.log('--- shop_subscriptions table ---');
    const shopSubResult = await pool.query(`
      SELECT
        id,
        status,
        next_payment_date,
        last_payment_date,
        payments_made,
        enrolled_at,
        activated_at,
        updated_at
      FROM shop_subscriptions
      WHERE shop_id = $1
      ORDER BY enrolled_at DESC
      LIMIT 1
    `, [shop.shop_id]);

    if (shopSubResult.rows.length > 0) {
      const sub = shopSubResult.rows[0];
      console.log(`Status: ${sub.status}`);
      console.log(`Payments Made: ${sub.payments_made}`);
      console.log(`Next Payment Date: ${sub.next_payment_date?.toISOString() || 'NULL'}`);
      console.log(`Last Payment Date: ${sub.last_payment_date?.toISOString() || 'NULL'}`);
      console.log(`Enrolled At: ${sub.enrolled_at?.toISOString()}`);
      console.log(`Updated At: ${sub.updated_at?.toISOString()}`);
    } else {
      console.log('No record found');
    }

    // 3. Check stripe_subscriptions table
    console.log('\n--- stripe_subscriptions table ---');
    const stripeSubResult = await pool.query(`
      SELECT
        id,
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
      const sub = stripeSubResult.rows[0];
      console.log(`Stripe Subscription ID: ${sub.stripe_subscription_id}`);
      console.log(`Status: ${sub.status}`);
      console.log(`Current Period Start: ${sub.current_period_start?.toISOString()}`);
      console.log(`Current Period End: ${sub.current_period_end?.toISOString()}`);
      console.log(`Cancel At Period End: ${sub.cancel_at_period_end}`);
      console.log(`Created At: ${sub.created_at?.toISOString()}`);
      console.log(`Updated At: ${sub.updated_at?.toISOString()}`);
    } else {
      console.log('No record found');
    }

    // 4. Compare dates
    console.log('\n--- COMPARISON ---');
    if (shopSubResult.rows.length > 0 && stripeSubResult.rows.length > 0) {
      const shopNextPayment = shopSubResult.rows[0].next_payment_date;
      const stripeCurrentPeriodEnd = stripeSubResult.rows[0].current_period_end;

      console.log(`shop_subscriptions.next_payment_date: ${shopNextPayment?.toLocaleDateString('en-US') || 'NULL'}`);
      console.log(`stripe_subscriptions.current_period_end: ${stripeCurrentPeriodEnd?.toLocaleDateString('en-US') || 'NULL'}`);

      if (shopNextPayment && stripeCurrentPeriodEnd) {
        const diffMs = stripeCurrentPeriodEnd.getTime() - shopNextPayment.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        console.log(`\nDifference: ${diffDays} days`);

        if (diffDays === 0) {
          console.log('✅ Dates are in sync!');
        } else {
          console.log('⚠️ Dates are OUT OF SYNC!');
        }
      }
    }

    // 5. What Shop view would show
    console.log('\n--- WHAT SHOP VIEW SHOWS ---');
    if (stripeSubResult.rows.length > 0) {
      const stripeSub = stripeSubResult.rows[0];
      const createdDate = new Date(stripeSub.created_at);
      const now = new Date();
      const monthsDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      const paymentsMade = Math.max(1, monthsDiff);

      console.log(`Calculated paymentsMade (months since creation): ${paymentsMade}`);
      console.log(`Next Payment Date shown: ${stripeSub.current_period_end?.toLocaleDateString('en-US')}`);

      // Check what the frontend calculation would be
      const currentPeriodEnd = stripeSub.current_period_end;
      if (currentPeriodEnd) {
        console.log(`\nThis is from stripe_subscriptions.current_period_end`);
        console.log(`The date should NOT change daily - it should only update when Stripe renews.`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSubscriptionDates();
