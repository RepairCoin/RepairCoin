/**
 * Script to investigate customer balance discrepancy
 *
 * Issue: Frontend shows 463 RCN but backend says 88 RCN
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

async function investigateBalance() {
  console.log('\n========================================');
  console.log('CUSTOMER BALANCE INVESTIGATION');
  console.log('========================================\n');

  try {
    // Find CodebilityDev customer
    const customerResult = await pool.query(`
      SELECT
        address,
        name,
        tier,
        current_rcn_balance,
        pending_mint_balance,
        lifetime_earnings,
        total_redemptions,
        last_blockchain_sync,
        GREATEST(0, COALESCE(lifetime_earnings, 0) - COALESCE(total_redemptions, 0) - COALESCE(pending_mint_balance, 0)) as calculated_available,
        (current_rcn_balance + COALESCE(pending_mint_balance, 0)) as total_balance_calc,
        (lifetime_earnings - COALESCE(total_redemptions, 0)) as total_balance_v2
      FROM customers
      WHERE LOWER(name) LIKE '%codebility%' OR LOWER(name) LIKE '%codeability%'
      LIMIT 5
    `);

    if (customerResult.rows.length === 0) {
      console.log('Customer "CodebilityDev" not found. Listing customers with name...');
      const allCustomers = await pool.query(`
        SELECT address, name, current_rcn_balance, lifetime_earnings, total_redemptions
        FROM customers
        WHERE name IS NOT NULL AND name != ''
        ORDER BY lifetime_earnings DESC
        LIMIT 10
      `);
      console.table(allCustomers.rows);
      return;
    }

    console.log('1. CUSTOMER DATA FROM DATABASE');
    console.log('----------------------------------------\n');

    for (const customer of customerResult.rows) {
      console.log(`Customer: ${customer.name} (${customer.address})`);
      console.log(`  - Tier: ${customer.tier}`);
      console.log(`  - current_rcn_balance: ${parseFloat(customer.current_rcn_balance || 0)}`);
      console.log(`  - pending_mint_balance: ${parseFloat(customer.pending_mint_balance || 0)}`);
      console.log(`  - lifetime_earnings: ${parseFloat(customer.lifetime_earnings || 0)}`);
      console.log(`  - total_redemptions: ${parseFloat(customer.total_redemptions || 0)}`);
      console.log(`  - last_blockchain_sync: ${customer.last_blockchain_sync}`);
      console.log('');
      console.log('  CALCULATED VALUES:');
      console.log(`  - calculated_available (lifetime - redemptions - pending): ${parseFloat(customer.calculated_available || 0)}`);
      console.log(`  - total_balance_calc (current + pending): ${parseFloat(customer.total_balance_calc || 0)}`);
      console.log(`  - total_balance_v2 (lifetime - redemptions): ${parseFloat(customer.total_balance_v2 || 0)}`);
      console.log('');

      // What does the backend getCustomerBalance return?
      console.log('2. WHAT getCustomerBalance() WOULD RETURN:');
      console.log('----------------------------------------\n');

      const lifetimeEarnings = parseFloat(customer.lifetime_earnings || 0);
      const totalRedemptions = parseFloat(customer.total_redemptions || 0);
      const pendingMintBalance = parseFloat(customer.pending_mint_balance || 0);
      const currentRcnBalance = parseFloat(customer.current_rcn_balance || 0);

      const databaseBalance = Math.max(0, lifetimeEarnings - totalRedemptions - pendingMintBalance);
      const totalBalance = lifetimeEarnings - totalRedemptions;

      console.log(`  databaseBalance: ${databaseBalance} (used by frontend for display)`);
      console.log(`  totalBalance: ${totalBalance} (checked by RedemptionSessionService)`);
      console.log('');

      // What does the UI show?
      console.log('3. ANALYSIS:');
      console.log('----------------------------------------\n');

      console.log(`  Frontend displays databaseBalance: ${databaseBalance}`);
      console.log(`  Backend checks totalBalance: ${totalBalance}`);
      console.log('');

      if (databaseBalance !== totalBalance) {
        console.log('  !! MISMATCH DETECTED !!');
        console.log(`  Difference due to pendingMintBalance: ${pendingMintBalance}`);
        console.log('');
        console.log('  The issue is:');
        console.log('  - RedemptionSessionService checks totalBalance (line 65)');
        console.log('  - But it should check databaseBalance (available balance)');
        console.log('  - OR the frontend should display totalBalance instead');
      }

      // Check for any pending redemptions
      console.log('\n4. RECENT REDEMPTION SESSIONS:');
      console.log('----------------------------------------\n');

      const sessionsResult = await pool.query(`
        SELECT
          session_id,
          amount,
          status,
          created_at,
          completed_at
        FROM redemption_sessions
        WHERE customer_address = $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [customer.address.toLowerCase()]);

      if (sessionsResult.rows.length > 0) {
        console.table(sessionsResult.rows);
      } else {
        console.log('  No recent redemption sessions found');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

investigateBalance();
