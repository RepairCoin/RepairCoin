import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function check() {
  const pool = getSharedPool();

  try {
    // Find Qua Ting's customer record
    const customerResult = await pool.query(`
      SELECT *
      FROM customers
      WHERE name ILIKE '%qua%ting%' OR name ILIKE '%quating%'
      LIMIT 1
    `);

    if (customerResult.rows.length === 0) {
      console.log('Customer not found');
      return;
    }

    const customer = customerResult.rows[0];
    console.log('=== Customer Record ===');
    console.log('Address:', customer.address);
    console.log('Name:', customer.name);
    console.log('');
    console.log('Customer Table Fields:');
    console.log('  lifetime_earnings:', customer.lifetime_earnings);
    console.log('  current_rcn_balance:', customer.current_rcn_balance);
    console.log('  pending_mint_balance:', customer.pending_mint_balance);
    console.log('  total_minted_to_wallet:', customer.total_minted_to_wallet);
    console.log('  total_redemptions:', customer.total_redemptions);

    // Get transaction totals - matching the VerificationService logic
    const txTotalsResult = await pool.query(`
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
    `, [customer.address]);

    const txTotals = txTotalsResult.rows[0];
    console.log('');
    console.log('=== Transaction Totals (from TransactionRepository.getCustomerTransactionTotals) ===');
    console.log('  total_redeemed (net of refunds):', txTotals.total_redeemed);
    console.log('  total_minted_to_wallet:', txTotals.total_minted_to_wallet);
    console.log('  total_earned:', txTotals.total_earned);

    // Calculate balance like VerificationService.getBalance does
    const lifetimeEarnings = parseFloat(customer.lifetime_earnings || 0);
    const totalRedeemed = parseFloat(txTotals.total_redeemed || 0);
    const pendingMintBalance = parseFloat(customer.pending_mint_balance || 0);
    const totalMintedToWallet = parseFloat(txTotals.total_minted_to_wallet || 0);

    const availableBalance = Math.max(0, lifetimeEarnings - totalRedeemed - pendingMintBalance - totalMintedToWallet);

    console.log('');
    console.log('=== Balance Calculation (VerificationService.getBalance) ===');
    console.log(`  lifetimeEarnings (from customer): ${lifetimeEarnings}`);
    console.log(`  - totalRedeemed (from tx):        ${totalRedeemed}`);
    console.log(`  - pendingMintBalance (from customer): ${pendingMintBalance}`);
    console.log(`  - totalMintedToWallet (from tx):  ${totalMintedToWallet}`);
    console.log(`  = availableBalance:               ${availableBalance}`);

    // Check individual redemption and refund transactions
    const redemptionsResult = await pool.query(`
      SELECT type, amount, reason, timestamp
      FROM transactions
      WHERE customer_address = $1 AND type IN ('redeem', 'service_redemption', 'service_redemption_refund')
      ORDER BY timestamp DESC
    `, [customer.address]);

    console.log('');
    console.log('=== Redemption/Refund Transactions ===');
    let totalRedemptions = 0;
    let totalRefunds = 0;
    for (const r of redemptionsResult.rows) {
      const prefix = r.type === 'service_redemption_refund' ? '+' : '-';
      console.log(`  ${prefix}${r.amount} RCN | ${r.type} | ${r.reason?.substring(0, 50) || 'N/A'}`);
      if (r.type === 'service_redemption_refund') {
        totalRefunds += parseFloat(r.amount);
      } else {
        totalRedemptions += parseFloat(r.amount);
      }
    }
    console.log(`  Total redemptions: ${totalRedemptions}`);
    console.log(`  Total refunds: ${totalRefunds}`);
    console.log(`  Net redeemed: ${totalRedemptions - totalRefunds}`);

    // Summary
    console.log('');
    console.log('========== SUMMARY ==========');
    console.log('Desktop shows: 31 RCN (130 earned - 99 redeemed)');
    console.log('Mobile shows: 85 RCN');
    console.log(`Backend calculation: ${availableBalance} RCN`);
    console.log('');

    if (Math.abs(availableBalance - 85) < 1) {
      console.log('✅ Backend matches MOBILE (85 RCN) - Mobile is CORRECT');
      console.log('❌ Desktop (31 RCN) appears to be using stale/incorrect data');
    } else if (Math.abs(availableBalance - 31) < 1) {
      console.log('✅ Backend matches DESKTOP (31 RCN) - Desktop is CORRECT');
      console.log('❌ Mobile (85 RCN) appears to be using stale/incorrect data');
    } else {
      console.log(`⚠️ Backend calculation (${availableBalance}) matches neither platform`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

check();
