/**
 * Find a paid order that hasn't been refunded yet
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
  console.log('Finding paid orders with Stripe payments...\n');

  const result = await pool.query(`
    SELECT order_id, shop_id, stripe_payment_intent_id, status, final_amount_usd
    FROM service_orders
    WHERE stripe_payment_intent_id IS NOT NULL
      AND stripe_payment_intent_id LIKE 'pi_%'
    ORDER BY created_at DESC
    LIMIT 15
  `);

  console.log(`Found ${result.rows.length} orders with Stripe payments\n`);

  for (const order of result.rows) {
    console.log(`Checking ${order.order_id}...`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Payment Intent: ${order.stripe_payment_intent_id}`);

    const refunds = await stripe.refunds.list({ payment_intent: order.stripe_payment_intent_id });
    console.log(`  Refunds: ${refunds.data.length}`);

    if (refunds.data.length === 0 && order.status === 'paid') {
      console.log(`\n✅ FOUND UNREFUNDED PAID ORDER!`);
      console.log(`   Order ID: ${order.order_id}`);
      console.log(`   Shop ID: ${order.shop_id}`);
      console.log(`   PaymentIntent: ${order.stripe_payment_intent_id}`);
      console.log(`   Amount: $${order.final_amount_usd}`);
      await pool.end();
      return;
    }
    console.log('');
  }

  console.log('\n❌ No unrefunded paid orders found.');
  console.log('All paid orders have already been refunded or are not in paid status.');
  await pool.end();
}

main().catch(console.error);
