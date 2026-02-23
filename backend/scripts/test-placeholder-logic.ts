/**
 * Test the placeholder detection logic directly (without HTTP)
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

async function testPlaceholderLogic() {
  console.log('\n=== TEST PLACEHOLDER DETECTION LOGIC ===\n');

  const testAddress = '0xC04f08e45d3b61f5e7Df499914fd716Af9854021'.toLowerCase();
  const testEmail = 'anna.cagunot@gmail.com';

  try {
    // Step 1: Check if customer exists by wallet (should NOT exist)
    console.log('1. Checking if customer exists by wallet address...');
    const customerByWallet = await pool.query(
      'SELECT address, email FROM customers WHERE LOWER(address) = $1',
      [testAddress]
    );

    if (customerByWallet.rows.length > 0) {
      console.log('   ⚠️  Customer already exists with this wallet!');
      console.log(`   Email: ${customerByWallet.rows[0].email}`);
      console.log('   This might be why placeholder detection isn\'t triggering.');
      console.log('   The customer was probably already auto-registered in a previous test.');

      // Clean up for next test
      console.log('\n   Cleaning up - deleting this customer for fresh test...');
      await pool.query('DELETE FROM customers WHERE LOWER(address) = $1', [testAddress]);
      console.log('   ✅ Deleted. You can now test again.');

    } else {
      console.log('   ✅ Customer does NOT exist with this wallet (correct)');
    }

    // Step 2: Check for placeholder by email
    console.log('\n2. Checking for placeholder customer by email...');
    const placeholderQuery = `
      SELECT address, email, phone, name, first_name, last_name
      FROM customers
      WHERE LOWER(email) = LOWER($1)
      AND LOWER(address) LIKE '0xmanual%'
      LIMIT 1
    `;
    const placeholderResult = await pool.query(placeholderQuery, [testEmail]);

    if (placeholderResult.rows.length > 0) {
      console.log('   ✅ Placeholder customer found!');
      console.log(`   Address: ${placeholderResult.rows[0].address}`);
      console.log(`   Email: ${placeholderResult.rows[0].email}`);
      console.log(`   Name: ${placeholderResult.rows[0].name}`);
      console.log(`   Phone: ${placeholderResult.rows[0].phone}`);

      console.log('\n3. The logic SHOULD work. Checking what would happen...');
      console.log('   - New customer would be created with real wallet');
      console.log('   - check-user would return exists: true, type: customer');
      console.log('   - User would be directed to customer dashboard');
      console.log('   - AccountClaimBanner would show to merge bookings');

    } else {
      console.log('   ❌ No placeholder customer found with this email!');
      console.log('   This is likely the problem - placeholder doesn\'t have the right email');
    }

    // Step 3: Check all accounts with this email
    console.log('\n4. All accounts with this email:');
    const allWithEmail = await pool.query(
      'SELECT address, email, name FROM customers WHERE LOWER(email) = LOWER($1)',
      [testEmail]
    );

    if (allWithEmail.rows.length === 0) {
      console.log('   No accounts found with this email');
    } else {
      allWithEmail.rows.forEach((row, i) => {
        const isPlaceholder = row.address.toLowerCase().startsWith('0xmanual');
        console.log(`   ${i + 1}. ${row.address}`);
        console.log(`      Email: ${row.email}`);
        console.log(`      Name: ${row.name}`);
        console.log(`      Is Placeholder: ${isPlaceholder}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testPlaceholderLogic();
