#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

async function checkWalletSubscription() {
  const walletAddress = '0x2dE1BdF96Bb5d861dEf85D5B8F2997792cB21Ece';
  console.log(`🔍 Checking subscription status for wallet: ${walletAddress}\n`);

  // Use the DATABASE_URL from staging environment
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment');
    console.log('Make sure you have the staging DATABASE_URL in your .env file');
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📊 Checking shop data...\n');

    // Check if shop exists
    const shopQuery = await pool.query(`
      SELECT 
        shop_id,
        name,
        wallet_address,
        email,
        active,
        verified,
        subscription_status,
        subscription_id,
        created_at,
        purchased_rcn_balance
      FROM shops 
      WHERE LOWER(wallet_address) = LOWER($1)
    `, [walletAddress]);

    if (shopQuery.rows.length === 0) {
      console.log('❌ Shop not found in staging database');
      console.log('This wallet is not registered as a shop in the staging environment');
      return;
    }

    const shop = shopQuery.rows[0];
    console.log('✅ Shop found:');
    console.log(`   Shop ID: ${shop.shop_id}`);
    console.log(`   Name: ${shop.name || 'N/A'}`);
    console.log(`   Email: ${shop.email || 'N/A'}`);
    console.log(`   Active: ${shop.active ? '✅ Yes' : '❌ No'}`);
    console.log(`   Verified: ${shop.verified ? '✅ Yes' : '❌ No'}`);
    console.log(`   Subscription Status: ${shop.subscription_status || 'N/A'}`);
    console.log(`   Subscription ID: ${shop.subscription_id || 'N/A'}`);
    console.log(`   Purchased RCN Balance: ${shop.purchased_rcn_balance || 0}`);
    console.log(`   Created: ${shop.created_at}`);

    // Check for RCN purchases
    console.log('\n💰 Checking RCN purchases...');
    
    try {
      const purchasesQuery = await pool.query(`
        SELECT 
          id,
          amount,
          price_per_rcn,
          total_cost,
          payment_method,
          status,
          created_at
        FROM shop_rcn_purchases 
        WHERE shop_id = $1
        ORDER BY created_at DESC
      `, [shop.shop_id]);

      if (purchasesQuery.rows.length === 0) {
        console.log('   No RCN purchases found');
      } else {
        console.log(`   Found ${purchasesQuery.rows.length} purchase(s):`);
        purchasesQuery.rows.forEach((purchase, index) => {
          console.log(`   ${index + 1}. ${purchase.amount} RCN @ $${purchase.price_per_rcn} = $${purchase.total_cost}`);
          console.log(`      Status: ${purchase.status}, Method: ${purchase.payment_method}`);
          console.log(`      Date: ${purchase.created_at}`);
        });
      }
    } catch (error) {
      console.log('   ⚠️  shop_rcn_purchases table not found (this is expected for staging)');
    }

    // Check for stripe subscriptions
    console.log('\n💳 Checking Stripe subscriptions...');
    
    try {
      const subscriptionQuery = await pool.query(`
        SELECT 
          id,
          stripe_customer_id,
          stripe_subscription_id,
          status,
          current_period_start,
          current_period_end,
          created_at
        FROM subscriptions 
        WHERE shop_id = $1
        ORDER BY created_at DESC
      `, [shop.shop_id]);

      if (subscriptionQuery.rows.length === 0) {
        console.log('   No Stripe subscriptions found');
      } else {
        console.log(`   Found ${subscriptionQuery.rows.length} subscription(s):`);
        subscriptionQuery.rows.forEach((sub, index) => {
          console.log(`   ${index + 1}. Status: ${sub.status}`);
          console.log(`      Stripe Customer: ${sub.stripe_customer_id}`);
          console.log(`      Stripe Subscription: ${sub.stripe_subscription_id}`);
          console.log(`      Period: ${sub.current_period_start} to ${sub.current_period_end}`);
          console.log(`      Created: ${sub.created_at}`);
        });
      }
    } catch (error) {
      console.log('   ⚠️  subscriptions table structure may be different');
    }

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkWalletSubscription().catch(console.error);