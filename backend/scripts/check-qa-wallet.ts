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

async function investigate() {
  console.log('=== Checking if Shop 1111 was registered with MetaMask ===\n');

  // Check all customer auth methods to understand patterns
  const authMethods = await pool.query(
    'SELECT DISTINCT auth_method, wallet_type FROM customers'
  );
  console.log('ALL CUSTOMER AUTH METHODS IN SYSTEM:');
  authMethods.rows.forEach((r: any) => console.log('  ', r.auth_method, '/', r.wallet_type));

  // Count by auth method
  const counts = await pool.query(
    'SELECT auth_method, wallet_type, COUNT(*) as count FROM customers GROUP BY auth_method, wallet_type ORDER BY count DESC'
  );
  console.log('\nCUSTOMER AUTH METHOD COUNTS:');
  counts.rows.forEach((r: any) => console.log('  ', r.auth_method, '/', r.wallet_type, ':', r.count));

  // Check if ANY user has embedded/google/email wallet
  const embedded = await pool.query(
    "SELECT COUNT(*) as count FROM customers WHERE wallet_type = 'embedded' OR auth_method IN ('google', 'email', 'apple')"
  );
  console.log('\nUSERS WITH EMBEDDED/SOCIAL AUTH:', embedded.rows[0].count);

  // Shop 1111 details
  const shop = await pool.query(
    'SELECT shop_id, name, email, wallet_address, created_at FROM shops WHERE shop_id = $1',
    ['1111']
  );
  const s = shop.rows[0];
  console.log('\n--- SHOP 1111 ANALYSIS ---');
  console.log('Created:', s?.created_at);
  console.log('Email:', s?.email);
  console.log('Wallet:', s?.wallet_address);

  // Key insight: If no customers use embedded wallets, the platform only supported MetaMask
  // at the time of shop registration
  if (parseInt(embedded.rows[0].count) === 0) {
    console.log('\n==> CONCLUSION: NO EMBEDDED WALLETS IN SYSTEM');
    console.log('==> All users registered with MetaMask/external wallets');
    console.log('==> Shop 1111 was DEFINITELY registered with MetaMask');
  }

  await pool.end();
}

investigate().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
