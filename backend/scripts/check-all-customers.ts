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

async function checkCustomers() {
  console.log('=== All customers with email anna.cagunot@gmail.com ===\n');

  const result = await pool.query(`
    SELECT address, email, name, created_at
    FROM customers
    WHERE LOWER(email) = LOWER($1)
    ORDER BY created_at DESC
  `, ['anna.cagunot@gmail.com']);

  console.log(`Found ${result.rows.length} customer(s):\n`);

  result.rows.forEach((row, i) => {
    const isPlaceholder = row.address.toLowerCase().startsWith('0xmanual');
    console.log(`${i + 1}. Address: ${row.address}`);
    console.log(`   Email: ${row.email}`);
    console.log(`   Name: ${row.name}`);
    console.log(`   Created: ${row.created_at}`);
    console.log(`   Is Placeholder: ${isPlaceholder}`);
    console.log('');
  });

  // Also check for the real wallet
  const realWallet = '0xc04f08e45d3b61f5e7df499914fd716af9854021';
  const realResult = await pool.query(`
    SELECT address, email, name FROM customers WHERE LOWER(address) = $1
  `, [realWallet]);

  console.log(`\n=== Checking real wallet ${realWallet} ===`);
  if (realResult.rows.length > 0) {
    console.log('Found customer with real wallet:');
    console.log(`   Email: ${realResult.rows[0].email}`);
    console.log(`   Name: ${realResult.rows[0].name}`);
  } else {
    console.log('No customer found with real wallet');
  }

  await pool.end();
}

checkCustomers().catch(console.error);
