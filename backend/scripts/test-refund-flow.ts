/**
 * Test the exact refund flow that the controller uses
 */
import Stripe from 'stripe';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });

async function testRefundFlow() {
  console.log('\n=== TESTING REFUND FLOW ===\n');

  // Get a PAID order (not cancelled) to test
  const result = await pool.query(`
    SELECT order_id, stripe_payment_intent_id, status, final_amount_usd
    FROM service_orders
    WHERE status = 'paid' AND stripe_payment_intent_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('No paid orders found. Using a cancelled order to trace the issue...');

    const cancelledResult = await pool.query(`
      SELECT order_id, stripe_payment_intent_id, status, final_amount_usd
      FROM service_orders
      WHERE status = 'cancelled' AND stripe_payment_intent_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (cancelledResult.rows.length === 0) {
      console.log('No orders with Stripe payment found');
      await pool.end();
      return;
    }

    const order = cancelledResult.rows[0];
    console.log('Using cancelled order for debugging:');
    console.log('  Order ID:', order.order_id);
    console.log('  Status:', order.status);
    console.log('  Stripe ID:', order.stripe_payment_intent_id);
    console.log('  Amount:', order.final_amount_usd);

    // Check if refund exists
    const refunds = await stripe.refunds.list({ payment_intent: order.stripe_payment_intent_id } as any);
    console.log('\nRefunds in Stripe:', refunds.data.length);

    if (refunds.data.length === 0) {
      console.log('\n❌ BUG CONFIRMED: Order was cancelled but NO refund was processed!');
      console.log('\nLet me check the condition logic:');
      console.log(`  order.stripePaymentIntentId = "${order.stripe_payment_intent_id}" (truthy: ${!!order.stripe_payment_intent_id})`);
      console.log(`  order.status = "${order.status}"`);
      console.log(`  order.status !== 'pending' = ${order.status !== 'pending'}`);

      console.log('\n=== MANUALLY PROCESSING REFUND NOW ===\n');

      try {
        const refund = await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id
        } as any);
        console.log('✅ Refund created successfully!');
        console.log('  Refund ID:', refund.id);
        console.log('  Amount:', refund.amount / 100);
        console.log('  Status:', refund.status);
      } catch (err: any) {
        console.log('❌ Refund failed:', err.message);
      }
    } else {
      console.log('Refunds exist - order was properly refunded');
    }

    await pool.end();
    return;
  }

  const order = result.rows[0];
  console.log('Found paid order:');
  console.log('  Order ID:', order.order_id);
  console.log('  Status:', order.status);
  console.log('  Stripe ID:', order.stripe_payment_intent_id);
  console.log('  Amount:', order.final_amount_usd);

  console.log('\nSimulating shop cancellation refund flow...');
  console.log('\n--- Condition Check ---');
  console.log(`order.stripePaymentIntentId = "${order.stripe_payment_intent_id}"`);
  console.log(`order.status = "${order.status}"`);
  console.log(`Condition: order.stripePaymentIntentId && order.status !== 'pending'`);
  console.log(`Result: ${order.stripe_payment_intent_id && order.status !== 'pending'}`);

  if (order.stripe_payment_intent_id && order.status !== 'pending') {
    console.log('\n✅ Condition would pass - refund should be processed');
    console.log('\nAttempting refund...');

    try {
      const refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id
      } as any);
      console.log('✅ Refund successful!');
      console.log('  Refund ID:', refund.id);
      console.log('  Amount:', refund.amount / 100);
    } catch (err: any) {
      console.log('❌ Refund failed:', err.message);
    }
  } else {
    console.log('\n❌ Condition would fail - refund would NOT be processed');
  }

  await pool.end();
}

testRefundFlow().catch(console.error);
