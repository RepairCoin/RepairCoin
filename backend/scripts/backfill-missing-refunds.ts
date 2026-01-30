/**
 * Backfill missing refunds for cancelled orders
 * These orders were cancelled but never refunded due to the 'requested_by_merchant' bug
 */
import Stripe from 'stripe';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

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

async function main() {
  console.log('\n=== BACKFILLING MISSING REFUNDS ===\n');

  // Find all cancelled orders with Stripe payment but no refunds
  const result = await pool.query(`
    SELECT order_id, stripe_payment_intent_id, final_amount_usd, customer_address
    FROM service_orders
    WHERE status = 'cancelled'
      AND stripe_payment_intent_id IS NOT NULL
      AND stripe_payment_intent_id LIKE 'pi_%'
    ORDER BY created_at DESC
  `);

  console.log(`Found ${result.rows.length} cancelled orders with Stripe payments\n`);

  let processed = 0;
  let alreadyRefunded = 0;
  let failed = 0;

  for (const order of result.rows) {
    console.log(`Checking ${order.order_id}...`);

    // Check if already has refunds
    const refunds = await stripe.refunds.list({ payment_intent: order.stripe_payment_intent_id });

    if (refunds.data.length > 0) {
      console.log(`  ✅ Already refunded`);
      alreadyRefunded++;
      continue;
    }

    // Process refund
    console.log(`  Processing refund for $${order.final_amount_usd}...`);

    try {
      const refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        reason: 'requested_by_customer'
      });

      console.log(`  ✅ Refunded: ${refund.id} ($${refund.amount / 100})`);
      processed++;
    } catch (error: any) {
      console.log(`  ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log('\n=== BACKFILL COMPLETE ===\n');
  console.log(`Total cancelled orders: ${result.rows.length}`);
  console.log(`Already refunded: ${alreadyRefunded}`);
  console.log(`Newly refunded: ${processed}`);
  console.log(`Failed: ${failed}`);

  await pool.end();
}

main().catch(console.error);
