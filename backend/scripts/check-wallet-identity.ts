/**
 * Read-only: check if a wallet address exists as a shop or customer.
 *
 * Usage:
 *   npx ts-node scripts/check-wallet-identity.ts 0xf4A77623e1706717eDa890c40A43Ac73b0C3A2FB
 *
 * Safety: refuses to run against prod (DB_HOST containing "prod").
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { Pool } from 'pg';

const ADDRESS = process.argv[2];

if (!ADDRESS) {
  console.error('Usage: npx ts-node scripts/check-wallet-identity.ts <wallet_address>');
  process.exit(1);
}

const dbHost = process.env.DB_HOST || '';
if (dbHost.toLowerCase().includes('prod')) {
  console.error('❌ REFUSING TO RUN: DB_HOST contains "prod". Staging only.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  console.log(`=== Check wallet identity ===`);
  console.log(`Target DB: ${dbHost}`);
  console.log(`Address:   ${ADDRESS}\n`);

  const client = await pool.connect();

  try {
    // Discover which address-like columns exist on shops
    const shopCols = (
      await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'shops' AND column_name IN
           ('shop_id','wallet_address','owner_address','owner_wallet','embedded_wallet_address','email','created_at','name')`
      )
    ).rows.map((r) => r.column_name);

    // Check shops on any wallet-like column
    const shopAddressCols = shopCols.filter((c) =>
      ['wallet_address', 'owner_address', 'owner_wallet', 'embedded_wallet_address'].includes(c)
    );

    let shopMatch: any = null;
    for (const col of shopAddressCols) {
      const r = await client.query(
        `SELECT ${shopCols.join(', ')} FROM shops WHERE LOWER(${col}) = LOWER($1) LIMIT 1`,
        [ADDRESS]
      );
      if (r.rows.length > 0) {
        shopMatch = { column: col, row: r.rows[0] };
        break;
      }
    }

    // Check customers
    const customerCols = (
      await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'customers' AND column_name IN
           ('address','wallet_address','email','first_name','last_name','name','created_at')`
      )
    ).rows.map((r) => r.column_name);

    const customerAddressCols = customerCols.filter((c) =>
      ['address', 'wallet_address'].includes(c)
    );

    let customerMatch: any = null;
    for (const col of customerAddressCols) {
      const r = await client.query(
        `SELECT ${customerCols.join(', ')} FROM customers WHERE LOWER(${col}) = LOWER($1) LIMIT 1`,
        [ADDRESS]
      );
      if (r.rows.length > 0) {
        customerMatch = { column: col, row: r.rows[0] };
        break;
      }
    }

    // Report
    if (shopMatch) {
      console.log(`✓ Found as SHOP (matched on column: ${shopMatch.column})`);
      for (const [k, v] of Object.entries(shopMatch.row)) {
        console.log(`  ${k.padEnd(28)} ${v ?? '(null)'}`);
      }
      console.log('');
    } else {
      console.log('✗ Not found in shops (checked: ' + shopAddressCols.join(', ') + ')\n');
    }

    if (customerMatch) {
      console.log(`✓ Found as CUSTOMER (matched on column: ${customerMatch.column})`);
      for (const [k, v] of Object.entries(customerMatch.row)) {
        console.log(`  ${k.padEnd(28)} ${v ?? '(null)'}`);
      }
      console.log('');
    } else {
      console.log('✗ Not found in customers (checked: ' + customerAddressCols.join(', ') + ')\n');
    }

    if (!shopMatch && !customerMatch) {
      console.log('Address does not exist in either shops or customers on this DB.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main();
