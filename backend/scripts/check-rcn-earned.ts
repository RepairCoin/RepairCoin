// Check RCN earned for booking BK-A11C8F
import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function checkRcnEarned() {
  const pool = getSharedPool();

  try {
    // Find the order by booking ID pattern (last 6 chars of order_id)
    const orderResult = await pool.query(`
      SELECT
        order_id,
        customer_address,
        shop_id,
        service_id,
        status,
        total_amount,
        rcn_redeemed,
        rcn_discount_usd,
        final_amount_usd,
        created_at,
        completed_at
      FROM service_orders
      WHERE order_id LIKE '%a11c8f'
         OR order_id LIKE '%A11C8F'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (orderResult.rows.length === 0) {
      console.log('Order not found');
      return;
    }

    const order = orderResult.rows[0];
    console.log('\n=== Order Details ===');
    console.log('Order ID:', order.order_id);
    console.log('Customer:', order.customer_address);
    console.log('Shop ID:', order.shop_id);
    console.log('Status:', order.status);
    console.log('Total Amount:', order.total_amount);
    console.log('RCN Redeemed:', order.rcn_redeemed);
    console.log('Final Amount USD:', order.final_amount_usd);
    console.log('Completed At:', order.completed_at);

    // Check transactions for this order
    console.log('\n=== Transactions for this customer ===');
    const txResult = await pool.query(`
      SELECT
        type,
        amount,
        reason,
        metadata,
        timestamp
      FROM transactions
      WHERE customer_address = $1
        AND (
          metadata->>'orderId' = $2
          OR reason LIKE $3
        )
      ORDER BY timestamp DESC
    `, [order.customer_address, order.order_id, `%${order.order_id}%`]);

    if (txResult.rows.length > 0) {
      for (const tx of txResult.rows) {
        console.log(`\nType: ${tx.type}`);
        console.log(`Amount: ${tx.amount}`);
        console.log(`Reason: ${tx.reason}`);
        console.log(`Timestamp: ${tx.timestamp}`);
      }
    } else {
      console.log('No transactions found for this order');
    }

    // Check for any earn transactions around the completion time
    if (order.completed_at) {
      console.log('\n=== Earn transactions near completion time ===');
      const earnResult = await pool.query(`
        SELECT
          type,
          amount,
          reason,
          shop_id,
          metadata,
          timestamp
        FROM transactions
        WHERE customer_address = $1
          AND type IN ('earn', 'reward', 'tier_bonus')
          AND timestamp >= $2::timestamp - interval '1 hour'
          AND timestamp <= $2::timestamp + interval '1 hour'
        ORDER BY timestamp DESC
      `, [order.customer_address, order.completed_at]);

      if (earnResult.rows.length > 0) {
        for (const tx of earnResult.rows) {
          console.log(`\nType: ${tx.type}`);
          console.log(`Amount: ${tx.amount}`);
          console.log(`Shop ID: ${tx.shop_id}`);
          console.log(`Reason: ${tx.reason}`);
          console.log(`Timestamp: ${tx.timestamp}`);
        }
      } else {
        console.log('No earn transactions found near completion time');
      }
    }

    // Check order_rewards table if it exists
    console.log('\n=== Checking order_rewards table ===');
    try {
      const rewardsResult = await pool.query(`
        SELECT * FROM order_rewards WHERE order_id = $1
      `, [order.order_id]);

      if (rewardsResult.rows.length > 0) {
        console.log('Order rewards:', rewardsResult.rows);
      } else {
        console.log('No rewards found in order_rewards table');
      }
    } catch (e) {
      console.log('order_rewards table may not exist');
    }

    // Check service for base RCN reward
    console.log('\n=== Service RCN Configuration ===');
    const serviceResult = await pool.query(`
      SELECT
        service_id,
        service_name,
        base_price,
        rcn_reward
      FROM services
      WHERE service_id = $1
    `, [order.service_id]);

    if (serviceResult.rows.length > 0) {
      const service = serviceResult.rows[0];
      console.log('Service:', service.service_name);
      console.log('Base Price:', service.base_price);
      console.log('RCN Reward configured:', service.rcn_reward);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkRcnEarned();
