import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function resetTestData() {
  console.log('=== Resetting test data ===\n');

  const placeholderAddress = '0xmanual8a25363d2eccff4f06fe62a32ad1f32492';
  const realWallet = '0xc04f08e45d3b61f5e7df499914fd716af9854021';

  try {
    // 1. Check current state
    const current = await pool.query(`
      SELECT address, email FROM customers WHERE LOWER(email) = LOWER('anna.cagunot@gmail.com')
    `);
    console.log('Current state:', current.rows[0]);

    // 2. If the account is using real wallet, reset it back to placeholder
    if (current.rows[0]?.address.toLowerCase() === realWallet.toLowerCase()) {
      console.log('\nResetting customer back to placeholder address...');

      // Reset customer address
      await pool.query(`
        UPDATE customers
        SET address = $1, wallet_address = $1
        WHERE LOWER(address) = LOWER($2)
      `, [placeholderAddress, realWallet]);

      // Reset service orders
      await pool.query(`
        UPDATE service_orders
        SET customer_address = $1
        WHERE LOWER(customer_address) = LOWER($2)
      `, [placeholderAddress, realWallet]);

      // Reset other tables
      await pool.query(`UPDATE customer_rcn_sources SET customer_address = $1 WHERE LOWER(customer_address) = LOWER($2)`, [placeholderAddress, realWallet]);
      await pool.query(`UPDATE conversations SET customer_address = $1 WHERE LOWER(customer_address) = LOWER($2)`, [placeholderAddress, realWallet]);
      await pool.query(`UPDATE notifications SET receiver_address = $1 WHERE LOWER(receiver_address) = LOWER($2)`, [placeholderAddress, realWallet]);

      console.log('✅ Reset complete!');
    } else {
      console.log('Account is already using placeholder address, no reset needed.');
    }

    // 3. Verify
    const afterReset = await pool.query(`
      SELECT address, email FROM customers WHERE LOWER(email) = LOWER('anna.cagunot@gmail.com')
    `);
    console.log('\nAfter reset:', afterReset.rows[0]);

    const orders = await pool.query(`
      SELECT order_id, customer_address FROM service_orders WHERE LOWER(customer_address) = LOWER($1)
    `, [placeholderAddress]);
    console.log(`Orders linked to placeholder: ${orders.rows.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

resetTestData();
