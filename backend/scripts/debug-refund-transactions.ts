import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function debug() {
  const pool = getSharedPool();
  const customerAddress = '0x6cd036477d1c39da021095a62a32c6bb919993cf';

  try {
    console.log('=== ALL REDEMPTION-RELATED TRANSACTIONS ===\n');

    // Get all redemption and refund transactions
    const txResult = await pool.query(`
      SELECT id, type, amount, reason, timestamp, metadata
      FROM transactions
      WHERE customer_address = $1
        AND type IN ('redeem', 'service_redemption', 'service_redemption_refund')
      ORDER BY timestamp DESC
    `, [customerAddress]);

    console.log(`Found ${txResult.rows.length} transactions:\n`);

    let grossRedemptions = 0;
    let refunds = 0;

    for (const tx of txResult.rows) {
      const sign = tx.type === 'service_redemption_refund' ? '+REFUND' : '-REDEEM';
      const amount = parseFloat(tx.amount);
      console.log(`${sign} ${amount.toFixed(2)} RCN | type: ${tx.type}`);
      console.log(`  reason: ${tx.reason?.substring(0, 60) || 'N/A'}`);
      console.log(`  id: ${tx.id}`);
      console.log(`  timestamp: ${tx.timestamp}`);
      console.log('');

      if (tx.type === 'service_redemption_refund') {
        refunds += amount;
      } else {
        grossRedemptions += amount;
      }
    }

    console.log('=== TRANSACTION TOTALS ===');
    console.log(`Gross redemptions: ${grossRedemptions} RCN`);
    console.log(`Refunds: ${refunds} RCN`);
    console.log(`Net (should be used): ${grossRedemptions - refunds} RCN`);

    // Now run the EXACT same query as TransactionRepository.getCustomerTransactionTotals
    console.log('\n=== EXACT TransactionRepository.getCustomerTransactionTotals QUERY ===');
    const exactQuery = `
      SELECT
        COALESCE(SUM(CASE
          WHEN type IN ('redeem', 'service_redemption') THEN amount
          WHEN type = 'service_redemption_refund' THEN -amount
          ELSE 0
        END), 0) as total_redeemed,
        COALESCE(SUM(CASE WHEN type = 'mint' AND (
          metadata->>'mintType' = 'instant_mint' OR
          metadata->>'source' = 'customer_dashboard'
        ) THEN amount ELSE 0 END), 0) as total_minted_to_wallet,
        COALESCE(SUM(CASE WHEN type IN ('earn', 'reward', 'referral_bonus', 'tier_bonus') THEN amount ELSE 0 END), 0) as total_earned
      FROM transactions
      WHERE customer_address = $1
    `;

    const exactResult = await pool.query(exactQuery, [customerAddress]);
    console.log('Result:', exactResult.rows[0]);
    console.log(`total_redeemed from query: ${parseFloat(exactResult.rows[0].total_redeemed)}`);

    // Check if maybe the refund transactions have different customer_address format
    console.log('\n=== CHECKING FOR CASE-SENSITIVITY ISSUES ===');
    const caseCheck = await pool.query(`
      SELECT DISTINCT customer_address, type, COUNT(*) as count
      FROM transactions
      WHERE LOWER(customer_address) = LOWER($1)
        AND type IN ('redeem', 'service_redemption', 'service_redemption_refund')
      GROUP BY customer_address, type
      ORDER BY customer_address
    `, [customerAddress]);

    console.log('Addresses and types found:');
    for (const row of caseCheck.rows) {
      console.log(`  ${row.customer_address} | ${row.type} | count: ${row.count}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debug();
