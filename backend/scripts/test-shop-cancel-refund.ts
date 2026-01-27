/**
 * Debug and Test Script: Shop Cancel with Stripe Refund
 *
 * This script will:
 * 1. Find a paid order from the database
 * 2. Check what's stored in stripe_payment_intent_id
 * 3. Try to retrieve the PaymentIntent from Stripe
 * 4. Attempt to process a refund
 *
 * Usage: npx ts-node scripts/test-shop-cancel-refund.ts [orderId]
 */

import Stripe from 'stripe';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any
});

async function debugAndTest(orderId?: string) {
  console.log('\n========== SHOP CANCEL REFUND DEBUG ==========\n');

  try {
    // Step 1: Get order from database
    let query = `
      SELECT order_id, stripe_payment_intent_id, status, final_amount_usd, rcn_redeemed, customer_address
      FROM service_orders
      WHERE status = 'paid' OR (status = 'cancelled' AND stripe_payment_intent_id IS NOT NULL)
      ORDER BY created_at DESC
      LIMIT 5
    `;

    if (orderId) {
      query = `
        SELECT order_id, stripe_payment_intent_id, status, final_amount_usd, rcn_redeemed, customer_address
        FROM service_orders
        WHERE order_id = $1
      `;
    }

    const result = orderId
      ? await pool.query(query, [orderId])
      : await pool.query(query);

    if (result.rows.length === 0) {
      console.log('❌ No orders found');
      return;
    }

    console.log('📋 Recent orders with payment info:\n');
    for (const row of result.rows) {
      console.log(`Order ID: ${row.order_id}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Stripe ID stored: ${row.stripe_payment_intent_id || 'NULL'}`);
      console.log(`  Amount: $${row.final_amount_usd}`);
      console.log(`  RCN Redeemed: ${row.rcn_redeemed}`);
      console.log('');
    }

    // Step 2: Pick the first order to debug
    const order = result.rows[0];
    const storedId = order.stripe_payment_intent_id;

    console.log('\n========== DEBUGGING ORDER ==========\n');
    console.log(`Order ID: ${order.order_id}`);
    console.log(`Stored Stripe ID: ${storedId}`);

    if (!storedId) {
      console.log('❌ No Stripe ID stored for this order');
      return;
    }

    // Step 3: Determine what type of ID is stored
    let paymentIntentId: string | null = null;

    if (storedId.startsWith('pi_')) {
      console.log('✅ Stored ID is a PaymentIntent ID (pi_)');
      paymentIntentId = storedId;
    } else if (storedId.startsWith('cs_')) {
      console.log('⚠️  Stored ID is a Checkout Session ID (cs_)');
      console.log('   Need to retrieve PaymentIntent from session...\n');

      try {
        const session = await stripe.checkout.sessions.retrieve(storedId);
        console.log('   Session status:', session.status);
        console.log('   Payment status:', session.payment_status);
        console.log('   Payment Intent:', session.payment_intent);

        if (session.payment_intent) {
          paymentIntentId = session.payment_intent as string;
          console.log(`\n✅ Retrieved PaymentIntent ID: ${paymentIntentId}`);
        } else {
          console.log('\n❌ No payment_intent in session');
        }
      } catch (err: any) {
        console.log('❌ Failed to retrieve session:', err.message);
      }
    } else if (storedId.startsWith('pm_')) {
      console.log('❌ Stored ID is a PaymentMethod ID (pm_) - WRONG!');
      console.log('   PaymentMethod IDs cannot be used for refunds');
      console.log('   This is a bug in how the payment was recorded');
    } else {
      console.log(`❓ Unknown ID format: ${storedId}`);
    }

    // Step 4: Try to retrieve the PaymentIntent
    if (paymentIntentId) {
      console.log('\n========== PAYMENT INTENT DETAILS ==========\n');
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        console.log('PaymentIntent ID:', paymentIntent.id);
        console.log('Status:', paymentIntent.status);
        console.log('Amount:', paymentIntent.amount / 100, paymentIntent.currency.toUpperCase());
        console.log('Created:', new Date(paymentIntent.created * 1000).toISOString());

        // Check if already refunded
        if (paymentIntent.amount_received === 0) {
          console.log('\n⚠️  Amount received is 0 - may already be refunded');
        }

        // Step 5: Attempt refund (only if not already refunded)
        console.log('\n========== ATTEMPTING REFUND ==========\n');

        // Check existing refunds
        const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId });
        if (refunds.data.length > 0) {
          console.log('⚠️  Existing refunds found:');
          for (const refund of refunds.data) {
            console.log(`   - ${refund.id}: $${refund.amount / 100} (${refund.status})`);
          }
          console.log('\nSkipping refund attempt - already refunded');
        } else {
          console.log('No existing refunds. Attempting refund...\n');

          try {
            const refund = await stripe.refunds.create({
              payment_intent: paymentIntentId
            } as any);

            console.log('✅ REFUND SUCCESSFUL!');
            console.log('   Refund ID:', refund.id);
            console.log('   Amount:', refund.amount / 100);
            console.log('   Status:', refund.status);
          } catch (refundErr: any) {
            console.log('❌ REFUND FAILED:', refundErr.message);
            if (refundErr.type === 'StripeInvalidRequestError') {
              console.log('   Error type:', refundErr.type);
              console.log('   Error code:', refundErr.code);
            }
          }
        }

      } catch (err: any) {
        console.log('❌ Failed to retrieve PaymentIntent:', err.message);
      }
    }

    console.log('\n========== DEBUG COMPLETE ==========\n');

  } catch (error) {
    console.error('Script error:', error);
  } finally {
    await pool.end();
  }
}

// Run with optional orderId argument
const orderId = process.argv[2];
debugAndTest(orderId);
