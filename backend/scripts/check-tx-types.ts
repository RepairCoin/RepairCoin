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

async function main() {
  const customerAddress = '0x6dc2e8e03116201c13fe61590df1f91a601ad61c';

  const result = await pool.query(`
    SELECT
      type,
      SUM(ABS(amount)) as total,
      COUNT(*) as count
    FROM transactions
    WHERE customer_address = $1
    GROUP BY type
    ORDER BY total DESC
  `, [customerAddress]);

  console.log('Transaction breakdown by type:');
  console.table(result.rows.map(r => ({
    type: r.type,
    total: parseFloat(r.total),
    count: parseInt(r.count)
  })));

  // Total all redemption-like transactions
  const redemptionTypes = await pool.query(`
    SELECT
      SUM(ABS(amount)) as total_all_redemptions
    FROM transactions
    WHERE customer_address = $1
    AND type IN ('redeem', 'service_redemption', 'redemption')
  `, [customerAddress]);

  console.log('\nTotal all redemption types:', parseFloat(redemptionTypes.rows[0].total_all_redemptions || 0));

  // Check if total redemptions = column value
  console.log('\nCustomer table total_redemptions column: 1594');
  console.log('Sum of redeem + service_redemption:', parseFloat(redemptionTypes.rows[0].total_all_redemptions || 0));

  await pool.end();
}

main();
