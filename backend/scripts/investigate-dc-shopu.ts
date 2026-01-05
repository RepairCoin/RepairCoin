import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function investigate() {
  console.log('=== INVESTIGATING dc_shopu ===\n');

  // Check ALL stripe_subscriptions for this shop
  const stripeSubs = await pool.query(
    "SELECT * FROM stripe_subscriptions WHERE shop_id = 'dc_shopu' ORDER BY created_at DESC"
  );

  console.log('STRIPE SUBSCRIPTIONS (all records):');
  stripeSubs.rows.forEach((row, i) => {
    console.log('\n--- Subscription ' + (i + 1) + ' ---');
    console.log('stripe_subscription_id:', row.stripe_subscription_id);
    console.log('status:', row.status);
    console.log('cancel_at_period_end:', row.cancel_at_period_end);
    console.log('canceled_at:', row.canceled_at);
    console.log('current_period_end:', row.current_period_end);
    console.log('created_at:', row.created_at);
    console.log('updated_at:', row.updated_at);
  });

  // Check shop_subscriptions
  const shopSub = await pool.query(
    "SELECT * FROM shop_subscriptions WHERE shop_id = 'dc_shopu'"
  );

  console.log('\n\n=== SHOP SUBSCRIPTION ===');
  if (shopSub.rows[0]) {
    const row = shopSub.rows[0];
    console.log('status:', row.status);
    console.log('is_active:', row.is_active);
    console.log('cancelled_at:', row.cancelled_at);
    console.log('cancellation_reason:', row.cancellation_reason);
    console.log('current_period_end:', row.current_period_end);
    console.log('billing_reference:', row.billing_reference);
  }

  // Check shop operational status
  const shop = await pool.query(
    "SELECT shop_id, name, operational_status, active FROM shops WHERE shop_id = 'dc_shopu'"
  );

  console.log('\n\n=== SHOP STATUS ===');
  if (shop.rows[0]) {
    console.log('name:', shop.rows[0].name);
    console.log('operational_status:', shop.rows[0].operational_status);
    console.log('active:', shop.rows[0].active);
  }

  await pool.end();
}

investigate().catch(e => {
  console.error(e);
  pool.end();
});
