// Check redemption data discrepancy
import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function checkDiscrepancy() {
  const pool = getSharedPool();

  try {
    // Check customer table data
    const customerResult = await pool.query(`
      SELECT
        name,
        current_rcn_balance,
        lifetime_earnings,
        total_redemptions
      FROM customers
      WHERE address = '0x6cd036477d1c39da021095a62a32c6bb919993cf'
    `);

    console.log('\n=== Customer Table Data ===');
    const c = customerResult.rows[0];
    console.log('Name:', c.name);
    console.log('current_rcn_balance:', c.current_rcn_balance);
    console.log('lifetime_earnings:', c.lifetime_earnings);
    console.log('total_redemptions:', c.total_redemptions);

    // Check transaction totals
    const txResult = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type IN ('redeem', 'service_redemption') THEN amount ELSE 0 END), 0) as gross_redeemed,
        COALESCE(SUM(CASE WHEN type = 'service_redemption_refund' THEN amount ELSE 0 END), 0) as refunded,
        COALESCE(SUM(CASE
          WHEN type IN ('redeem', 'service_redemption') THEN amount
          WHEN type = 'service_redemption_refund' THEN -amount
          ELSE 0
        END), 0) as net_redeemed
      FROM transactions
      WHERE customer_address = '0x6cd036477d1c39da021095a62a32c6bb919993cf'
    `);

    console.log('\n=== Transaction Totals ===');
    const t = txResult.rows[0];
    console.log('Gross Redeemed (total ever used):', t.gross_redeemed);
    console.log('Refunded:', t.refunded);
    console.log('Net Redeemed (after refunds):', t.net_redeemed);

    console.log('\n=== Analysis ===');
    console.log('Balance Formula: lifetime_earnings - net_redeemed = available_balance');
    console.log(`${c.lifetime_earnings} - ${t.net_redeemed} = ${parseFloat(c.lifetime_earnings) - parseFloat(t.net_redeemed)}`);

    console.log('\n=== What UI Shows ===');
    console.log('Tokens Earned: Uses lifetime_earnings from customer table =', c.lifetime_earnings);
    console.log('Tokens Redeemed: Uses net_redeemed from transactions =', t.net_redeemed);
    console.log('Available Balance: lifetime_earnings - net_redeemed =', parseFloat(c.lifetime_earnings) - parseFloat(t.net_redeemed));

    console.log('\n=== Potential Discrepancy ===');
    console.log('Customer table total_redemptions:', c.total_redemptions);
    console.log('Transaction table net_redeemed:', t.net_redeemed);
    console.log('These SHOULD match. Difference:', parseFloat(c.total_redemptions) - parseFloat(t.net_redeemed));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkDiscrepancy();
