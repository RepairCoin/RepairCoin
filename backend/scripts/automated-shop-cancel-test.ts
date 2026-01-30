/**
 * Automated E2E Test: Shop Cancel with Stripe Refund
 *
 * This script tests the entire shop cancellation flow:
 * 1. Finds a paid order in the database
 * 2. Generates a valid JWT token for the shop
 * 3. Calls the actual shop-cancel API endpoint
 * 4. Verifies the refund in Stripe
 *
 * Usage: npx ts-node scripts/automated-shop-cancel-test.ts
 */

import Stripe from 'stripe';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import axios from 'axios';
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

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';
const JWT_SECRET = process.env.JWT_SECRET!;

interface TestOrder {
  order_id: string;
  shop_id: string;
  stripe_payment_intent_id: string;
  status: string;
  final_amount_usd: number;
  rcn_redeemed: number;
}

async function generateShopToken(shopId: string, walletAddress: string): Promise<string> {
  return jwt.sign(
    {
      address: walletAddress,
      role: 'shop',
      shopId: shopId
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function findPaidOrder(specificOrderId?: string): Promise<TestOrder | null> {
  console.log('\n📋 STEP 1: Finding a paid order with Stripe payment...\n');

  // If specific order ID provided, use that
  if (specificOrderId) {
    const result = await pool.query(`
      SELECT
        order_id,
        shop_id,
        stripe_payment_intent_id,
        status,
        final_amount_usd,
        rcn_redeemed
      FROM service_orders
      WHERE order_id = $1
    `, [specificOrderId]);

    if (result.rows.length > 0) {
      const order = result.rows[0];
      console.log('   ✅ Found specified order:');
      console.log(`      Order ID: ${order.order_id}`);
      console.log(`      Shop ID: ${order.shop_id}`);
      console.log(`      Status: ${order.status}`);
      console.log(`      Stripe Payment Intent: ${order.stripe_payment_intent_id}`);
      console.log(`      Amount: $${order.final_amount_usd}`);
      console.log(`      RCN Redeemed: ${order.rcn_redeemed || 0}`);
      return order;
    }
  }

  const result = await pool.query(`
    SELECT
      so.order_id,
      so.shop_id,
      so.stripe_payment_intent_id,
      so.status,
      so.final_amount_usd,
      so.rcn_redeemed
    FROM service_orders so
    WHERE so.status = 'paid'
      AND so.stripe_payment_intent_id IS NOT NULL
      AND so.stripe_payment_intent_id LIKE 'pi_%'
    ORDER BY so.created_at DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('   ⚠️  No paid orders found. Checking for any order with Stripe payment...\n');

    const anyResult = await pool.query(`
      SELECT
        order_id,
        shop_id,
        stripe_payment_intent_id,
        status,
        final_amount_usd,
        rcn_redeemed
      FROM service_orders
      WHERE stripe_payment_intent_id IS NOT NULL
        AND stripe_payment_intent_id LIKE 'pi_%'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (anyResult.rows.length > 0) {
      console.log('   Available orders with Stripe payments:');
      anyResult.rows.forEach((row: any) => {
        console.log(`     - ${row.order_id}: status=${row.status}, pi=${row.stripe_payment_intent_id}`);
      });
      console.log('\n   None of them are in "paid" status for testing.\n');
    }

    return null;
  }

  const order = result.rows[0];
  console.log('   ✅ Found paid order:');
  console.log(`      Order ID: ${order.order_id}`);
  console.log(`      Shop ID: ${order.shop_id}`);
  console.log(`      Status: ${order.status}`);
  console.log(`      Stripe Payment Intent: ${order.stripe_payment_intent_id}`);
  console.log(`      Amount: $${order.final_amount_usd}`);
  console.log(`      RCN Redeemed: ${order.rcn_redeemed || 0}`);

  return order;
}

async function getShopWalletAddress(shopId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT wallet_address FROM shops WHERE shop_id = $1',
    [shopId]
  );
  return result.rows[0]?.wallet_address || null;
}

async function checkStripeRefundsBefore(paymentIntentId: string): Promise<number> {
  console.log('\n📋 STEP 2: Checking existing Stripe refunds...\n');

  const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId });
  console.log(`   Existing refunds: ${refunds.data.length}`);

  if (refunds.data.length > 0) {
    refunds.data.forEach(r => {
      console.log(`     - ${r.id}: $${r.amount/100} (${r.status})`);
    });
  }

  return refunds.data.length;
}

async function callShopCancelEndpoint(
  orderId: string,
  shopToken: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  console.log('\n📋 STEP 3: Calling shop-cancel API endpoint...\n');
  console.log(`   URL: POST ${API_BASE_URL}/api/services/orders/${orderId}/shop-cancel`);

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/services/orders/${orderId}/shop-cancel`,
      {
        cancellationReason: 'shop_closed',
        cancellationNotes: 'Automated test - shop closed unexpectedly'
      },
      {
        headers: {
          'Authorization': `Bearer ${shopToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('   ✅ API Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error: any) {
    console.log('   ❌ API Error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

async function checkStripeRefundsAfter(paymentIntentId: string, previousCount: number): Promise<boolean> {
  console.log('\n📋 STEP 4: Verifying Stripe refund was processed...\n');

  // Wait a moment for Stripe to process
  await new Promise(resolve => setTimeout(resolve, 2000));

  const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId });
  console.log(`   Total refunds now: ${refunds.data.length}`);

  if (refunds.data.length > previousCount) {
    console.log('   ✅ NEW REFUND DETECTED!');
    const newRefund = refunds.data[0];
    console.log(`     - Refund ID: ${newRefund.id}`);
    console.log(`     - Amount: $${newRefund.amount/100}`);
    console.log(`     - Status: ${newRefund.status}`);
    console.log(`     - Created: ${new Date(newRefund.created * 1000).toISOString()}`);
    return true;
  } else {
    console.log('   ❌ NO NEW REFUND - The refund was NOT processed!');
    return false;
  }
}

async function checkOrderStatusInDb(orderId: string): Promise<void> {
  console.log('\n📋 STEP 5: Checking order status in database...\n');

  const result = await pool.query(
    'SELECT status, cancellation_reason, cancellation_notes FROM service_orders WHERE order_id = $1',
    [orderId]
  );

  if (result.rows.length > 0) {
    const order = result.rows[0];
    console.log(`   Status: ${order.status}`);
    console.log(`   Cancellation Reason: ${order.cancellation_reason || 'N/A'}`);
    console.log(`   Cancellation Notes: ${order.cancellation_notes || 'N/A'}`);
  }
}

async function runTest(specificOrderId?: string) {
  console.log('\n' + '='.repeat(60));
  console.log('    AUTOMATED SHOP CANCELLATION REFUND TEST');
  console.log('='.repeat(60));

  try {
    // Step 1: Find a paid order
    const order = await findPaidOrder(specificOrderId);
    if (!order) {
      console.log('\n❌ TEST ABORTED: No paid order available to test.\n');
      console.log('   To test, you need a paid order with a Stripe payment.\n');
      await pool.end();
      return;
    }

    // Get shop wallet address for token generation
    const shopWalletAddress = await getShopWalletAddress(order.shop_id);
    if (!shopWalletAddress) {
      console.log('\n❌ TEST ABORTED: Could not find shop wallet address.\n');
      await pool.end();
      return;
    }
    console.log(`\n   Shop wallet: ${shopWalletAddress}`);

    // Step 2: Check existing refunds in Stripe
    const refundCountBefore = await checkStripeRefundsBefore(order.stripe_payment_intent_id);

    // Step 3: Generate shop token and call API
    const shopToken = await generateShopToken(order.shop_id, shopWalletAddress);
    console.log(`\n   Generated shop JWT token (first 50 chars): ${shopToken.substring(0, 50)}...`);

    const apiResult = await callShopCancelEndpoint(order.order_id, shopToken);

    if (!apiResult.success) {
      console.log('\n❌ TEST FAILED: API call failed.\n');
      await pool.end();
      return;
    }

    // Step 4: Verify refund in Stripe
    const refundCreated = await checkStripeRefundsAfter(order.stripe_payment_intent_id, refundCountBefore);

    // Step 5: Check order status in database
    await checkOrderStatusInDb(order.order_id);

    // Final result
    console.log('\n' + '='.repeat(60));
    if (refundCreated) {
      console.log('    ✅ TEST PASSED: Shop cancellation refund works correctly!');
    } else {
      console.log('    ❌ TEST FAILED: Refund was NOT processed in Stripe');
      console.log('    Check server logs for: "=== SHOP CANCELLATION REFUND STARTED ===" ');
      console.log('    and "=== PROCESSING STRIPE REFUND ===" messages.');
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error);
  } finally {
    await pool.end();
  }
}

// Run with optional orderId argument
const orderId = process.argv[2];
runTest(orderId);
