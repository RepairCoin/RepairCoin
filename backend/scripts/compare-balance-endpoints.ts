import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function compareEndpoints() {
  const pool = getSharedPool();

  try {
    // Find Qua Ting's customer record
    const customerResult = await pool.query(`
      SELECT address, name, lifetime_earnings, current_rcn_balance,
             pending_mint_balance, total_redemptions
      FROM customers
      WHERE name ILIKE '%qua%ting%' OR name ILIKE '%quating%'
      LIMIT 1
    `);

    if (customerResult.rows.length === 0) {
      console.log('Customer not found');
      return;
    }

    const customer = customerResult.rows[0];
    console.log('=== CUSTOMER TABLE VALUES ===');
    console.log('Address:', customer.address);
    console.log('Name:', customer.name);
    console.log('lifetime_earnings:', parseFloat(customer.lifetime_earnings || 0));
    console.log('current_rcn_balance:', parseFloat(customer.current_rcn_balance || 0));
    console.log('pending_mint_balance:', parseFloat(customer.pending_mint_balance || 0));
    console.log('total_redemptions:', parseFloat(customer.total_redemptions || 0));

    // =============================
    // DESKTOP ENDPOINT CALCULATION
    // /api/tokens/balance/:address -> VerificationService.getBalance()
    // Uses transactionRepository.getCustomerTransactionTotals()
    // =============================
    console.log('\n=== DESKTOP: /api/tokens/balance/:address ===');
    console.log('(VerificationService.getBalance -> transactionRepository.getCustomerTransactionTotals)');

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
        ) THEN amount ELSE 0 END), 0) as total_minted_to_wallet
      FROM transactions
      WHERE customer_address = $1
    `, [customer.address]);

    const txTotals = txTotalsResult.rows[0];
    const lifetimeEarnings = parseFloat(customer.lifetime_earnings || 0);
    const txTotalRedeemed = parseFloat(txTotals.total_redeemed || 0);
    const pendingMintBalance = parseFloat(customer.pending_mint_balance || 0);
    const txTotalMintedToWallet = parseFloat(txTotals.total_minted_to_wallet || 0);

    const desktopBalance = Math.max(0, lifetimeEarnings - txTotalRedeemed - pendingMintBalance - txTotalMintedToWallet);

    console.log('  lifetimeEarnings (from customer):', lifetimeEarnings);
    console.log('  totalRedeemed (from transactions, with refunds subtracted):', txTotalRedeemed);
    console.log('  pendingMintBalance (from customer):', pendingMintBalance);
    console.log('  totalMintedToWallet (from transactions):', txTotalMintedToWallet);
    console.log('  CALCULATED availableBalance:', desktopBalance);

    // =============================
    // MOBILE ENDPOINT CALCULATION
    // /api/customers/balance/:address -> CustomerBalanceService.getCustomerBalanceInfo()
    // Uses customerRepository.getCustomerBalance() which uses customers.total_redemptions directly
    // =============================
    console.log('\n=== MOBILE: /api/customers/balance/:address ===');
    console.log('(CustomerBalanceService -> customerRepository.getCustomerBalance)');

    const mobileResult = await pool.query(`
      SELECT
        c.lifetime_earnings,
        c.total_redemptions,
        c.pending_mint_balance,
        COALESCE((
          SELECT SUM(ABS(amount))
          FROM transactions t
          WHERE t.customer_address = c.address
            AND t.type = 'mint'
            AND (
              t.metadata->>'mintType' = 'instant_mint' OR
              t.metadata->>'source' = 'customer_dashboard'
            )
        ), 0) as total_minted_to_wallet,
        GREATEST(0,
          COALESCE(c.lifetime_earnings, 0) -
          COALESCE(c.total_redemptions, 0) -
          COALESCE(c.pending_mint_balance, 0) -
          COALESCE((
            SELECT SUM(ABS(amount))
            FROM transactions t
            WHERE t.customer_address = c.address
              AND t.type = 'mint'
              AND (
                t.metadata->>'mintType' = 'instant_mint' OR
                t.metadata->>'source' = 'customer_dashboard'
              )
          ), 0)
        ) as calculated_available_balance
      FROM customers c
      WHERE c.address = $1
    `, [customer.address]);

    const mobileData = mobileResult.rows[0];
    const mobileLifetimeEarnings = parseFloat(mobileData.lifetime_earnings || 0);
    const mobileTotalRedemptions = parseFloat(mobileData.total_redemptions || 0);
    const mobilePendingMint = parseFloat(mobileData.pending_mint_balance || 0);
    const mobileMintedToWallet = parseFloat(mobileData.total_minted_to_wallet || 0);
    const mobileBalance = parseFloat(mobileData.calculated_available_balance || 0);

    console.log('  lifetimeEarnings (from customer):', mobileLifetimeEarnings);
    console.log('  total_redemptions (from customer table, NO refund adjustment):', mobileTotalRedemptions);
    console.log('  pendingMintBalance (from customer):', mobilePendingMint);
    console.log('  totalMintedToWallet (from transactions):', mobileMintedToWallet);
    console.log('  CALCULATED databaseBalance:', mobileBalance);

    // =============================
    // SUMMARY
    // =============================
    console.log('\n========== COMPARISON SUMMARY ==========');
    console.log(`Desktop endpoint should return: ${desktopBalance} RCN`);
    console.log(`Mobile endpoint should return: ${mobileBalance} RCN`);
    console.log('');
    console.log('User reports: Desktop shows 31 RCN, Mobile shows 85 RCN');
    console.log('');

    if (Math.abs(desktopBalance - 85) < 1 && Math.abs(mobileBalance - 31) < 1) {
      console.log('❌ INVERTED! Desktop formula gives 85, Mobile formula gives 31');
      console.log('   But user sees Desktop=31, Mobile=85');
      console.log('   This means frontend might be using wrong data source!');
    } else if (Math.abs(desktopBalance - 31) < 1 && Math.abs(mobileBalance - 85) < 1) {
      console.log('✅ Expected: Desktop=31, Mobile=85');
      console.log('   Desktop uses customers.total_redemptions (no refund adjustment)');
      console.log('   Mobile uses transaction-based calculation (with refunds)');
    } else {
      console.log(`Unexpected: Desktop=${desktopBalance}, Mobile=${mobileBalance}`);
    }

    // Show all redemption/refund transactions for debugging
    console.log('\n=== ALL REDEMPTION/REFUND TRANSACTIONS ===');
    const txResult = await pool.query(`
      SELECT type, amount, reason, timestamp
      FROM transactions
      WHERE customer_address = $1
        AND type IN ('redeem', 'service_redemption', 'service_redemption_refund')
      ORDER BY timestamp DESC
    `, [customer.address]);

    let totalRedemptionsTx = 0;
    let totalRefundsTx = 0;
    for (const tx of txResult.rows) {
      const sign = tx.type === 'service_redemption_refund' ? '+' : '-';
      console.log(`  ${sign}${parseFloat(tx.amount).toFixed(2)} RCN | ${tx.type} | ${tx.reason?.substring(0, 50) || 'N/A'}`);
      if (tx.type === 'service_redemption_refund') {
        totalRefundsTx += parseFloat(tx.amount);
      } else {
        totalRedemptionsTx += parseFloat(tx.amount);
      }
    }
    console.log(`\n  Gross redemptions: ${totalRedemptionsTx} RCN`);
    console.log(`  Total refunds: ${totalRefundsTx} RCN`);
    console.log(`  Net redemptions: ${totalRedemptionsTx - totalRefundsTx} RCN`);

    // KEY FINDING
    console.log('\n========== ROOT CAUSE ANALYSIS ==========');
    if (mobileTotalRedemptions !== (totalRedemptionsTx - totalRefundsTx)) {
      console.log('🔴 ROOT CAUSE FOUND!');
      console.log(`   customers.total_redemptions = ${mobileTotalRedemptions} (NOT updated when refunds happen)`);
      console.log(`   Actual net redemptions = ${totalRedemptionsTx - totalRefundsTx} (from transactions)`);
      console.log('');
      console.log('   The mobile endpoint uses customers.total_redemptions directly,');
      console.log('   which does NOT account for refunds (service_redemption_refund transactions).');
      console.log('');
      console.log('   FIX NEEDED: Either:');
      console.log('   1. Update customers.total_redemptions when processing refunds, OR');
      console.log('   2. Change mobile endpoint to use transaction-based calculation like desktop');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

compareEndpoints();
