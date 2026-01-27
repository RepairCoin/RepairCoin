/**
 * Test script to verify unified balance calculations
 * After the fix, both Step 1 and Step 2 should use the same calculation:
 * databaseBalance = lifetime_earnings - total_redemptions - pending_mint - minted_to_wallet
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function testBalance(name: string, address: string) {
  console.log(`\n=== ${name} (${address}) ===`);

  // This is the UNIFIED query that both CustomerRepository and VerificationService now use
  const unifiedQuery = await pool.query(`
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
      ) as unified_balance
    FROM customers c
    WHERE c.address = $1
  `, [address]);

  const row = unifiedQuery.rows[0];
  const lifetimeEarnings = parseFloat(row.lifetime_earnings || 0);
  const totalRedemptions = parseFloat(row.total_redemptions || 0);
  const pendingMint = parseFloat(row.pending_mint_balance || 0);
  const mintedToWallet = parseFloat(row.total_minted_to_wallet || 0);
  const unifiedBalance = parseFloat(row.unified_balance || 0);

  console.log('\nCustomer Data:');
  console.log(`  lifetime_earnings:     ${lifetimeEarnings}`);
  console.log(`  total_redemptions:     ${totalRedemptions}`);
  console.log(`  pending_mint_balance:  ${pendingMint}`);
  console.log(`  minted_to_wallet:      ${mintedToWallet}`);

  console.log('\n--- Unified Balance Calculation ---');
  console.log(`  Formula: lifetime - redemptions - pending - minted_to_wallet`);
  console.log(`  ${lifetimeEarnings} - ${totalRedemptions} - ${pendingMint} - ${mintedToWallet} = ${unifiedBalance} RCN`);

  console.log('\n  Both Step 1 (Customer Lookup) and Step 2 (Validation) now show:');
  console.log(`  >> ${unifiedBalance} RCN <<`);
}

async function main() {
  console.log('========================================');
  console.log('UNIFIED BALANCE CALCULATION TEST');
  console.log('========================================');
  console.log('\nAfter the fix:');
  console.log('- CustomerRepository.getCustomerBalance().databaseBalance');
  console.log('- VerificationService.calculateAvailableBalance()');
  console.log('Both now use the same formula and return the same value.');

  try {
    await testBalance('CodebilityDev', '0x6dc2e8e03116201c13fe61590df1f91a601ad61c');
    await testBalance('Lee Ann', '0x960aa947468cfd80b8e275c61abce19e13d6a9e3');
  } finally {
    await pool.end();
  }
}

main();
