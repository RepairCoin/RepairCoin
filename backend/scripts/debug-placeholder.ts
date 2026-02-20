/**
 * Debug script to check placeholder accounts and test the detection logic
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
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

async function debugPlaceholderAccounts() {
  console.log('\n=== PLACEHOLDER ACCOUNT DEBUG ===\n');

  try {
    // 1. Check for all placeholder accounts
    console.log('1. All placeholder accounts:');
    const allPlaceholders = await pool.query(`
      SELECT address, email, phone, name, created_at
      FROM customers
      WHERE LOWER(address) LIKE '0xmanual%'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (allPlaceholders.rows.length === 0) {
      console.log('   ❌ No placeholder accounts found!');
    } else {
      allPlaceholders.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. Address: ${row.address}`);
        console.log(`      Email: ${row.email || '(none)'}`);
        console.log(`      Phone: ${row.phone || '(none)'}`);
        console.log(`      Name: ${row.name || '(none)'}`);
        console.log(`      Created: ${row.created_at}`);
        console.log('');
      });
    }

    // 2. Test specific email lookup
    const testEmail = 'anna.cagunot@gmail.com';
    console.log(`\n2. Looking for placeholder with email: ${testEmail}`);

    const specificResult = await pool.query(`
      SELECT address, email, phone, name
      FROM customers
      WHERE LOWER(email) = LOWER($1)
      AND LOWER(address) LIKE '0xmanual%'
      LIMIT 1
    `, [testEmail]);

    if (specificResult.rows.length === 0) {
      console.log(`   ❌ No placeholder found with email: ${testEmail}`);

      // Check if email exists but with different address type
      const anyEmailMatch = await pool.query(`
        SELECT address, email FROM customers WHERE LOWER(email) = LOWER($1)
      `, [testEmail]);

      if (anyEmailMatch.rows.length > 0) {
        console.log(`   ⚠️  Email exists but NOT as placeholder:`);
        anyEmailMatch.rows.forEach(row => {
          console.log(`       Address: ${row.address}`);
          console.log(`       Is placeholder: ${row.address.toLowerCase().startsWith('0xmanual')}`);
        });
      }
    } else {
      console.log(`   ✅ Found placeholder:`);
      console.log(`      Address: ${specificResult.rows[0].address}`);
      console.log(`      Email: ${specificResult.rows[0].email}`);
    }

    // 3. Check what's in the database for the real wallet
    const realWallet = '0xC04f08e45d3b61f5e7Df499914fd716Af9854021'.toLowerCase();
    console.log(`\n3. Checking real wallet: ${realWallet}`);

    const realWalletResult = await pool.query(`
      SELECT address, email, name FROM customers WHERE LOWER(address) = $1
    `, [realWallet]);

    if (realWalletResult.rows.length === 0) {
      console.log('   ✅ Real wallet NOT in customers table (expected for new user)');
    } else {
      console.log('   ⚠️  Real wallet already exists in customers table:');
      console.log(`      Email: ${realWalletResult.rows[0].email}`);
      console.log(`      Name: ${realWalletResult.rows[0].name}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugPlaceholderAccounts();
