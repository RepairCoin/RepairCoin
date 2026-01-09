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

async function check() {
  try {
    // Check for customer with email gossipmcallen
    console.log('=== Customer with email gossipmcallen@gmail.com ===');
    const customer = await pool.query(
      "SELECT address, email, name, is_active FROM customers WHERE email ILIKE '%gossipmcallen%'"
    );
    if (customer.rows.length === 0) {
      console.log('No customer found with this email');
    } else {
      console.table(customer.rows);
    }

    // Check for shop named Repaircoin
    console.log('\n=== Shop named Repaircoin ===');
    const shop = await pool.query(
      "SELECT shop_id, name, wallet_address, verified, active FROM shops WHERE name ILIKE '%repaircoin%'"
    );
    if (shop.rows.length === 0) {
      console.log('No shop found with this name');
    } else {
      console.table(shop.rows);
    }

    // Check wallet address starting with 0x4851
    console.log('\n=== Accounts with wallet 0x4851... ===');
    const walletCustomer = await pool.query(
      "SELECT 'customer' as type, address, name, email FROM customers WHERE address ILIKE '0x4851%'"
    );
    const walletShop = await pool.query(
      "SELECT 'shop' as type, wallet_address as address, name, email FROM shops WHERE wallet_address ILIKE '0x4851%'"
    );

    const allWallets = [...walletCustomer.rows, ...walletShop.rows];
    if (allWallets.length === 0) {
      console.log('No accounts found with wallet starting 0x4851');
    } else {
      console.table(allWallets);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

check();
