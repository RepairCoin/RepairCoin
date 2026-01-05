/**
 * Fix customer balance - Reset to correct calculated value
 *
 * This script:
 * 1. Calculates the correct balance based on lifetime_earnings - total_redemptions - minted_to_wallet
 * 2. Resets current_rcn_balance and pending_mint_balance to correct values
 *
 * Run: npx ts-node scripts/fix-customer-balance-v2.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const CUSTOMER_ADDRESS = '0x150e4A7bCF6204BEbe0EFe08fE7479f2eE30A24e'.toLowerCase();
const MINTED_TO_WALLET = 20; // The 20 RCN that was successfully minted to blockchain

async function fixCustomerBalance() {
  // Support both DATABASE_URL and individual DB_* variables
  const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      })
    : new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
      });

  const client = await pool.connect();

  try {
    console.log('Starting balance fix for customer:', CUSTOMER_ADDRESS);

    // Start transaction
    await client.query('BEGIN');

    // Step 1: Get current state
    const currentState = await client.query(
      `SELECT address, current_rcn_balance, pending_mint_balance, lifetime_earnings, total_redemptions
       FROM customers WHERE LOWER(address) = $1`,
      [CUSTOMER_ADDRESS]
    );

    if (currentState.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = currentState.rows[0];
    console.log('Current state (WRONG):', customer);

    const lifetimeEarnings = parseFloat(customer.lifetime_earnings);
    const totalRedemptions = parseFloat(customer.total_redemptions);

    // Correct balance = lifetime_earnings - total_redemptions - minted_to_wallet
    // 110 - 36 - 20 = 54 RCN
    const correctBalance = lifetimeEarnings - totalRedemptions - MINTED_TO_WALLET;

    console.log(`\nCalculation:`);
    console.log(`  Lifetime Earnings: ${lifetimeEarnings}`);
    console.log(`  Total Redemptions: ${totalRedemptions}`);
    console.log(`  Minted to Wallet:  ${MINTED_TO_WALLET}`);
    console.log(`  Correct Balance:   ${correctBalance}`);

    // Step 2: Reset the balance to correct value
    const fixBalance = await client.query(
      `UPDATE customers
       SET
         current_rcn_balance = $1,
         pending_mint_balance = 0,
         updated_at = NOW()
       WHERE LOWER(address) = $2
       RETURNING current_rcn_balance, pending_mint_balance`,
      [correctBalance, CUSTOMER_ADDRESS]
    );

    console.log('\nAfter fix:', fixBalance.rows[0]);

    // Step 3: Check if mint transaction already exists
    const TX_HASH = '0xf1a16e8e3d3ce480d74192e1917ed6b0a11446e03a39feb81f5ad60b1e3ade13';
    const existingTx = await client.query(
      `SELECT id FROM transactions WHERE transaction_hash = $1`,
      [TX_HASH]
    );

    if (existingTx.rows.length === 0) {
      // Insert transaction record for the 20 RCN mint
      await client.query(
        `INSERT INTO transactions (
           type, customer_address, shop_id, amount, reason,
           transaction_hash, block_number, timestamp, status, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)`,
        [
          'mint',
          CUSTOMER_ADDRESS,
          null,
          MINTED_TO_WALLET,
          'Customer instant mint to wallet',
          TX_HASH,
          null,
          'confirmed',
          JSON.stringify({ mintType: 'instant_mint', source: 'customer_dashboard' })
        ]
      );
      console.log('Transaction record inserted');
    } else {
      console.log('Transaction record already exists');
    }

    // Commit transaction
    await client.query('COMMIT');

    // Verify final state
    const finalState = await client.query(
      `SELECT address, current_rcn_balance, pending_mint_balance, lifetime_earnings, total_redemptions
       FROM customers WHERE LOWER(address) = $1`,
      [CUSTOMER_ADDRESS]
    );

    console.log('\n=== FINAL STATE ===');
    console.log('Customer:', finalState.rows[0]);
    console.log(`\nExpected: ${correctBalance} RCN`);
    console.log(`Actual:   ${finalState.rows[0].current_rcn_balance} RCN`);
    console.log('\n✅ Balance fix completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error fixing balance:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixCustomerBalance()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
