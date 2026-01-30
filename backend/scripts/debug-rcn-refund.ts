// Debug script to investigate RCN refund issue
import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function debugRcnRefund() {
  const pool = getSharedPool();
  try {
    // Find the most recent cancelled order with RCN redeemed
    console.log('\n=== Finding recent cancelled orders with RCN ===\n');

    const ordersResult = await pool.query(`
      SELECT
        order_id,
        customer_address,
        status,
        rcn_redeemed,
        rcn_discount_usd,
        final_amount_usd,
        cancellation_reason,
        created_at,
        updated_at
      FROM service_orders
      WHERE status = 'cancelled'
        AND rcn_redeemed > 0
      ORDER BY updated_at DESC
      LIMIT 5
    `);

    console.log('Recent cancelled orders with RCN:');
    for (const order of ordersResult.rows) {
      console.log(`\nOrder: ${order.order_id}`);
      console.log(`  Customer: ${order.customer_address}`);
      console.log(`  RCN Redeemed: ${order.rcn_redeemed}`);
      console.log(`  RCN Discount: $${order.rcn_discount_usd}`);
      console.log(`  Final Amount: $${order.final_amount_usd}`);
      console.log(`  Cancellation Reason: ${order.cancellation_reason}`);
      console.log(`  Created: ${order.created_at}`);
      console.log(`  Updated: ${order.updated_at}`);

      // Check customer balance
      const customerResult = await pool.query(`
        SELECT
          address,
          name,
          current_rcn_balance,
          lifetime_earnings,
          total_redemptions
        FROM customers
        WHERE address = $1
      `, [order.customer_address]);

      if (customerResult.rows.length > 0) {
        const customer = customerResult.rows[0];
        console.log(`\n  Customer Balance Info:`);
        console.log(`    Name: ${customer.name}`);
        console.log(`    Current RCN Balance: ${customer.current_rcn_balance}`);
        console.log(`    Lifetime Earnings: ${customer.lifetime_earnings}`);
        console.log(`    Total Redemptions: ${customer.total_redemptions}`);
      }
    }

    // Check for any RCN transaction logs
    console.log('\n\n=== Checking RCN transactions for cancellation refunds ===\n');

    const txResult = await pool.query(`
      SELECT
        transaction_id,
        customer_address,
        transaction_type,
        rcn_amount,
        description,
        created_at
      FROM rcn_transactions
      WHERE transaction_type LIKE '%refund%'
         OR transaction_type LIKE '%cancel%'
         OR description LIKE '%cancel%'
         OR description LIKE '%refund%'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (txResult.rows.length > 0) {
      console.log('RCN refund/cancellation transactions:');
      for (const tx of txResult.rows) {
        console.log(`\n  TX: ${tx.transaction_id}`);
        console.log(`  Type: ${tx.transaction_type}`);
        console.log(`  Amount: ${tx.rcn_amount} RCN`);
        console.log(`  Description: ${tx.description}`);
        console.log(`  Created: ${tx.created_at}`);
      }
    } else {
      console.log('No refund/cancellation transactions found in rcn_transactions table');
    }

    // Check the specific customer "Qua Ting" (from the screenshot)
    console.log('\n\n=== Checking customer "Qua Ting" specifically ===\n');

    const quaTingResult = await pool.query(`
      SELECT
        address,
        name,
        email,
        current_rcn_balance,
        lifetime_earnings,
        total_redemptions,
        updated_at
      FROM customers
      WHERE name ILIKE '%qua%' OR name ILIKE '%ting%'
      LIMIT 5
    `);

    for (const customer of quaTingResult.rows) {
      console.log(`Customer: ${customer.name}`);
      console.log(`  Address: ${customer.address}`);
      console.log(`  Current RCN Balance: ${customer.current_rcn_balance}`);
      console.log(`  Lifetime Earnings: ${customer.lifetime_earnings}`);
      console.log(`  Total Redemptions: ${customer.total_redemptions}`);
      console.log(`  Last Updated: ${customer.updated_at}`);
    }

    // Directly check customer by address from the order
    console.log('\n\n=== Checking customer 0x6cd036477d1c39da021095a62a32c6bb919993cf ===\n');

    const specificCustomer = await pool.query(`
      SELECT
        address,
        name,
        email,
        current_rcn_balance,
        lifetime_earnings,
        total_redemptions,
        updated_at
      FROM customers
      WHERE address = '0x6cd036477d1c39da021095a62a32c6bb919993cf'
    `);

    if (specificCustomer.rows.length > 0) {
      const c = specificCustomer.rows[0];
      console.log(`Customer: ${c.name}`);
      console.log(`  Address: ${c.address}`);
      console.log(`  Current RCN Balance: ${c.current_rcn_balance}`);
      console.log(`  Lifetime Earnings: ${c.lifetime_earnings}`);
      console.log(`  Total Redemptions: ${c.total_redemptions}`);
      console.log(`  Last Updated: ${c.updated_at}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugRcnRefund();
