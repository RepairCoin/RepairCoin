/**
 * Script to investigate balance calculation discrepancies
 *
 * There are 3 different sources for balance:
 * 1. customers.total_redemptions column
 * 2. SUM of redemption transactions
 * 3. SUM of minted_to_wallet transactions
 */

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function investigateBalanceSources() {
  console.log('\n========================================');
  console.log('BALANCE SOURCES INVESTIGATION');
  console.log('========================================\n');

  try {
    // Find customer - change name here to investigate different customers
    const searchName = process.argv[2] || 'lee ann';
    console.log(`Searching for customer: "${searchName}"\n`);

    const customerResult = await pool.query(`
      SELECT
        address,
        name,
        lifetime_earnings,
        total_redemptions,
        pending_mint_balance,
        current_rcn_balance
      FROM customers
      WHERE LOWER(name) LIKE $1
      LIMIT 1
    `, [`%${searchName.toLowerCase()}%`]);

    if (customerResult.rows.length === 0) {
      console.log('Customer not found');
      return;
    }

    const customer = customerResult.rows[0];
    const customerAddress = customer.address;

    console.log('1. CUSTOMER TABLE DATA');
    console.log('----------------------------------------');
    console.log(`  Address: ${customerAddress}`);
    console.log(`  Name: ${customer.name}`);
    console.log(`  lifetime_earnings: ${parseFloat(customer.lifetime_earnings || 0)}`);
    console.log(`  total_redemptions (column): ${parseFloat(customer.total_redemptions || 0)}`);
    console.log(`  pending_mint_balance: ${parseFloat(customer.pending_mint_balance || 0)}`);
    console.log(`  current_rcn_balance: ${parseFloat(customer.current_rcn_balance || 0)}`);

    // Get actual redemption totals from transactions table
    console.log('\n2. TRANSACTIONS TABLE DATA');
    console.log('----------------------------------------');

    const transactionTotals = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'redeem' THEN ABS(amount) ELSE 0 END), 0) as total_redeemed,
        COALESCE(SUM(CASE WHEN type = 'mint' AND (
          metadata->>'mintType' = 'instant_mint' OR
          metadata->>'source' = 'customer_dashboard'
        ) THEN ABS(amount) ELSE 0 END), 0) as total_minted_to_wallet,
        COUNT(*) FILTER (WHERE type = 'redeem') as redemption_count,
        COUNT(*) FILTER (WHERE type = 'mint') as mint_count
      FROM transactions
      WHERE customer_address = $1
    `, [customerAddress.toLowerCase()]);

    const totals = transactionTotals.rows[0];
    console.log(`  total_redeemed (from transactions): ${parseFloat(totals.total_redeemed || 0)}`);
    console.log(`  total_minted_to_wallet: ${parseFloat(totals.total_minted_to_wallet || 0)}`);
    console.log(`  redemption_count: ${totals.redemption_count}`);
    console.log(`  mint_count: ${totals.mint_count}`);

    // Calculate balances using different methods
    console.log('\n3. BALANCE CALCULATIONS COMPARISON');
    console.log('----------------------------------------');

    const lifetimeEarnings = parseFloat(customer.lifetime_earnings || 0);
    const totalRedemptionsColumn = parseFloat(customer.total_redemptions || 0);
    const pendingMintBalance = parseFloat(customer.pending_mint_balance || 0);
    const totalRedeemedFromTx = parseFloat(totals.total_redeemed || 0);
    const totalMintedToWallet = parseFloat(totals.total_minted_to_wallet || 0);

    // Method 1: CustomerRepository.getCustomerBalance().totalBalance
    const totalBalanceMethod1 = lifetimeEarnings - totalRedemptionsColumn;
    console.log(`\n  METHOD 1 - CustomerRepository (RedemptionSessionService uses this):`);
    console.log(`    totalBalance = lifetime_earnings - total_redemptions_column`);
    console.log(`    totalBalance = ${lifetimeEarnings} - ${totalRedemptionsColumn} = ${totalBalanceMethod1}`);

    // Method 2: CustomerRepository.getCustomerBalance().databaseBalance
    const databaseBalance = Math.max(0, lifetimeEarnings - totalRedemptionsColumn - pendingMintBalance);
    console.log(`\n  METHOD 2 - CustomerRepository databaseBalance (Frontend displays this):`);
    console.log(`    databaseBalance = lifetime_earnings - total_redemptions_column - pending_mint`);
    console.log(`    databaseBalance = ${lifetimeEarnings} - ${totalRedemptionsColumn} - ${pendingMintBalance} = ${databaseBalance}`);

    // Method 3: VerificationService.calculateAvailableBalance()
    const availableBalanceMethod3 = Math.max(0, lifetimeEarnings - totalRedeemedFromTx - pendingMintBalance - totalMintedToWallet);
    console.log(`\n  METHOD 3 - VerificationService (verifyRedemption uses this):`);
    console.log(`    availableBalance = lifetime_earnings - total_redeemed_tx - pending_mint - minted_to_wallet`);
    console.log(`    availableBalance = ${lifetimeEarnings} - ${totalRedeemedFromTx} - ${pendingMintBalance} - ${totalMintedToWallet} = ${availableBalanceMethod3}`);

    // Check for discrepancy
    console.log('\n4. DISCREPANCY ANALYSIS');
    console.log('----------------------------------------');

    const discrepancy = totalRedemptionsColumn - totalRedeemedFromTx;
    if (Math.abs(discrepancy) > 0.01) {
      console.log(`\n  !! DISCREPANCY DETECTED !!`);
      console.log(`  customers.total_redemptions: ${totalRedemptionsColumn}`);
      console.log(`  SUM(transactions.redemption): ${totalRedeemedFromTx}`);
      console.log(`  Difference: ${discrepancy}`);
      console.log(`\n  This means the customers.total_redemptions column is OUT OF SYNC`);
      console.log(`  with actual transaction records!`);
    } else {
      console.log(`  No discrepancy between column and transaction sum.`);
    }

    // Check if 463 makes sense
    console.log('\n5. WHERE COULD 463 RCN COME FROM?');
    console.log('----------------------------------------');

    // Could it be from a different calculation?
    const possibleValue = lifetimeEarnings - totalRedeemedFromTx - totalMintedToWallet;
    console.log(`  lifetimeEarnings - totalRedeemedFromTx - totalMintedToWallet = ${possibleValue}`);

    const withoutPending = lifetimeEarnings - totalRedemptionsColumn;
    console.log(`  lifetimeEarnings - total_redemptions_column = ${withoutPending}`);

    // Show recent transactions
    console.log('\n6. RECENT TRANSACTIONS');
    console.log('----------------------------------------');

    const recentTx = await pool.query(`
      SELECT
        type,
        amount,
        created_at
      FROM transactions
      WHERE customer_address = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [customerAddress.toLowerCase()]);

    if (recentTx.rows.length > 0) {
      console.table(recentTx.rows.map(r => ({
        type: r.type,
        amount: parseFloat(r.amount),
        date: new Date(r.created_at).toLocaleString()
      })));
    } else {
      console.log('  No transactions found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

investigateBalanceSources();
