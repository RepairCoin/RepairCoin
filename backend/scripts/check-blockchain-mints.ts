/**
 * Check blockchain mint transactions for a customer
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const CUSTOMER_ADDRESS = '0x150e4A7bCF6204BEbe0EFe08fE7479f2eE30A24e'.toLowerCase();

async function checkMints() {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
      });

  try {
    // Check all transactions with transaction_hash (blockchain mints)
    const result = await pool.query(
      `SELECT type, amount, reason, transaction_hash, metadata, timestamp
       FROM transactions
       WHERE LOWER(customer_address) = $1
       AND transaction_hash IS NOT NULL
       ORDER BY timestamp DESC`,
      [CUSTOMER_ADDRESS]
    );

    console.log('Blockchain transactions for customer:');
    console.log(JSON.stringify(result.rows, null, 2));

    // Sum up only actual mints (type='mint') with real transaction hashes
    const mints = result.rows.filter((tx: any) => tx.type === 'mint' && tx.transaction_hash && tx.transaction_hash.startsWith('0x'));
    const totalMinted = mints.reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
    console.log('\nActual mints to blockchain:', mints.length, 'transactions');
    console.log('Total minted to blockchain:', totalMinted, 'RCN');

    // Sum up redemptions (tokens that should have been burned)
    const redeems = result.rows.filter((tx: any) => tx.type === 'redeem');
    const totalRedeemed = redeems.reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
    console.log('\nRedemptions:', redeems.length, 'transactions');
    console.log('Total redeemed:', totalRedeemed, 'RCN');

    console.log('\nExpected on-chain balance:', totalMinted - totalRedeemed, 'RCN');

  } finally {
    await pool.end();
  }
}

checkMints();
