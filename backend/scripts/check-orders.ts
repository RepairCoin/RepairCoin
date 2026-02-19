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

async function checkOrders() {
  console.log('=== Checking service orders for placeholder address ===\n');

  const placeholderAddress = '0xmanual8a25363d2eccff4f06fe62a32ad1f32492';
  const realWallet = '0xc04f08e45d3b61f5e7df499914fd716af9854021';

  // Check orders with old placeholder address
  const oldOrders = await pool.query(`
    SELECT order_id, customer_address, status, created_at
    FROM service_orders
    WHERE LOWER(customer_address) = LOWER($1)
  `, [placeholderAddress]);

  console.log(`Orders with OLD placeholder address (${placeholderAddress}):`);
  console.log(`Found ${oldOrders.rows.length} order(s)\n`);
  oldOrders.rows.forEach((row) => {
    console.log(`  - Order ${row.order_id}: ${row.status} (${row.created_at})`);
  });

  // Check orders with new real wallet
  const newOrders = await pool.query(`
    SELECT order_id, customer_address, status, created_at
    FROM service_orders
    WHERE LOWER(customer_address) = LOWER($1)
  `, [realWallet]);

  console.log(`\nOrders with NEW real wallet (${realWallet}):`);
  console.log(`Found ${newOrders.rows.length} order(s)\n`);
  newOrders.rows.forEach((row) => {
    console.log(`  - Order ${row.order_id}: ${row.status} (${row.created_at})`);
  });

  await pool.end();
}

checkOrders().catch(console.error);
