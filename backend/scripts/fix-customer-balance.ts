/**
 * Fix customer balance after instant mint testing
 *
 * This script:
 * 1. Cancels the 40 RCN pending mint (returns to available balance)
 * 2. Deducts the 20 RCN that was minted to blockchain
 * 3. Records the mint transaction for proper tracking
 *
 * Run: npx ts-node scripts/fix-customer-balance.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const CUSTOMER_ADDRESS = '0x150e4A7bCF6204BEbe0EFe08fE7479f2eE30A24e'.toLowerCase();
const PENDING_AMOUNT = 40;
const MINTED_AMOUNT = 20;
const TX_HASH = '0xf1a16e8e3d3ce480d74192e1917ed6b0a11446e03a39feb81f5ad60b1e3ade13';

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

    console.log('Current state:', currentState.rows[0]);

    // Step 2: Cancel the 40 RCN pending mint (return to available balance)
    const cancelPending = await client.query(
      `UPDATE customers
       SET
         current_rcn_balance = COALESCE(current_rcn_balance, 0) + $1,
         pending_mint_balance = 0,
         updated_at = NOW()
       WHERE LOWER(address) = $2
       RETURNING current_rcn_balance, pending_mint_balance`,
      [PENDING_AMOUNT, CUSTOMER_ADDRESS]
    );

    console.log('After canceling pending:', cancelPending.rows[0]);

    // Step 3: Deduct the 20 RCN that was minted to blockchain
    const deductMinted = await client.query(
      `UPDATE customers
       SET
         current_rcn_balance = COALESCE(current_rcn_balance, 0) - $1,
         updated_at = NOW()
       WHERE LOWER(address) = $2
       RETURNING current_rcn_balance`,
      [MINTED_AMOUNT, CUSTOMER_ADDRESS]
    );

    console.log('After deducting minted amount:', deductMinted.rows[0]);

    // Step 4: Check if transaction already exists
    const existingTx = await client.query(
      `SELECT id FROM transactions WHERE transaction_hash = $1`,
      [TX_HASH]
    );

    if (existingTx.rows.length === 0) {
      // Step 5: Insert transaction record for the 20 RCN mint
      await client.query(
        `INSERT INTO transactions (
           type, customer_address, shop_id, amount, reason,
           transaction_hash, block_number, timestamp, status, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)`,
        [
          'mint',
          CUSTOMER_ADDRESS,
          null,
          MINTED_AMOUNT,
          'Customer instant mint to wallet',
          TX_HASH,
          null,
          'confirmed',
          JSON.stringify({ mintType: 'instant_mint', source: 'customer_dashboard' })
        ]
      );
      console.log('Transaction record inserted');
    } else {
      console.log('Transaction record already exists, skipping insert');
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

    const balance = finalState.rows[0];
    const expectedAvailable = balance.lifetime_earnings - balance.total_redemptions - MINTED_AMOUNT;
    console.log(`Expected available: ${balance.lifetime_earnings} - ${balance.total_redemptions} - ${MINTED_AMOUNT} = ${expectedAvailable} RCN`);
    console.log(`Actual current_rcn_balance: ${balance.current_rcn_balance} RCN`);
    console.log('\nBalance fix completed successfully!');

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
