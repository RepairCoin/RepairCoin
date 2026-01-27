// Check transaction metadata for orderId
import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function check() {
  const pool = getSharedPool();

  try {
    const result = await pool.query(`
      SELECT type, amount, reason, metadata, timestamp
      FROM transactions
      WHERE customer_address = '0x6cd036477d1c39da021095a62a32c6bb919993cf'
        AND type = 'mint'
        AND reason LIKE '%450.01%'
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      console.log('Transaction found:');
      console.log('Type:', result.rows[0].type);
      console.log('Amount:', result.rows[0].amount);
      console.log('Reason:', result.rows[0].reason);
      console.log('Metadata:', JSON.stringify(result.rows[0].metadata, null, 2));
    } else {
      console.log('Transaction not found');
    }

    // Also check what the JOIN would return
    console.log('\n=== Testing JOIN query ===');
    const joinResult = await pool.query(`
      SELECT
        o.order_id,
        t.amount as rcn_earned,
        t.metadata
      FROM service_orders o
      LEFT JOIN transactions t ON t.metadata->>'orderId' = o.order_id AND t.type = 'mint'
      WHERE o.order_id LIKE '%a11c8f'
    `);

    if (joinResult.rows.length > 0) {
      console.log('Order ID:', joinResult.rows[0].order_id);
      console.log('RCN Earned from JOIN:', joinResult.rows[0].rcn_earned);
      console.log('Metadata:', JSON.stringify(joinResult.rows[0].metadata, null, 2));
    } else {
      console.log('No results from JOIN');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

check();
