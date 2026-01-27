/**
 * Test the approve booking endpoint
 *
 * Usage: npx ts-node scripts/test-approve-endpoint.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function testApproveEndpoint() {
  const host = process.env.DB_HOST || 'localhost';
  const sslEnabled = process.env.DB_SSL === 'true' || host.includes('digitalocean');

  const config: any = {
    host,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'repaircoin',
    user: process.env.DB_USER || 'repaircoin',
    password: process.env.DB_PASSWORD || 'repaircoin123',
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  };

  if (process.env.DATABASE_URL) {
    config.connectionString = process.env.DATABASE_URL;
    if (process.env.DATABASE_URL.includes('sslmode=require')) {
      config.ssl = { rejectUnauthorized: false };
    }
  }

  console.log(`\n🔌 Connecting to database...\n`);

  const pool = new Pool(config);

  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Get a paid order to test with
    const orderResult = await pool.query(`
      SELECT
        order_id,
        shop_id,
        status,
        shop_approved
      FROM service_orders
      WHERE status = 'paid'
      AND (shop_approved IS NULL OR shop_approved = FALSE)
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (orderResult.rows.length === 0) {
      console.log('❌ No paid orders found to test with\n');
      return;
    }

    const order = orderResult.rows[0];
    console.log('📋 Test Order:');
    console.log(`   Order ID: ${order.order_id}`);
    console.log(`   Shop ID: ${order.shop_id}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Approved: ${order.shop_approved}\n`);

    // Test the approve query directly
    console.log('🧪 Testing approve query...\n');

    const approveResult = await pool.query(`
      UPDATE service_orders
      SET
        shop_approved = TRUE,
        approved_at = NOW(),
        approved_by = $1,
        updated_at = NOW()
      WHERE order_id = $2
      RETURNING order_id, shop_approved, approved_at, approved_by
    `, ['test-shop-address', order.order_id]);

    if (approveResult.rows.length > 0) {
      console.log('✅ Approve query succeeded!');
      console.log(`   Order ID: ${approveResult.rows[0].order_id}`);
      console.log(`   Approved: ${approveResult.rows[0].shop_approved}`);
      console.log(`   Approved At: ${approveResult.rows[0].approved_at}`);
      console.log(`   Approved By: ${approveResult.rows[0].approved_by}\n`);

      // Revert for testing purposes
      await pool.query(`
        UPDATE service_orders
        SET shop_approved = FALSE, approved_at = NULL, approved_by = NULL
        WHERE order_id = $1
      `, [order.order_id]);
      console.log('🔄 Reverted approval for testing purposes\n');
    }

    // Print the API endpoint info
    console.log('📡 API Endpoint Info:');
    console.log(`   Method: POST`);
    console.log(`   URL: /api/services/orders/{orderId}/approve`);
    console.log(`   Example: /api/services/orders/${order.order_id}/approve`);
    console.log(`   Auth: Requires shop role\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testApproveEndpoint();
