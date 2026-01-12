/**
 * Fix platform statistics - Create materialized view
 *
 * This script creates the platform_statistics materialized view
 * that is required by AdminRepository.refreshPlatformStatistics()
 *
 * Usage: npx ts-node scripts/fix-platform-statistics.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function fixPlatformStatistics() {
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

  console.log(`\n🔌 Connecting to database: ${config.host}:${config.port}/${config.database}\n`);

  const pool = new Pool(config);

  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Check required tables exist
    const tablesCheck = await pool.query(`
      SELECT
        (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions')) as has_transactions,
        (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers')) as has_customers,
        (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shops')) as has_shops
    `);

    const tables = tablesCheck.rows[0];
    console.log('📋 Required tables check:');
    console.log(`   transactions: ${tables.has_transactions ? '✅' : '❌'}`);
    console.log(`   customers: ${tables.has_customers ? '✅' : '❌'}`);
    console.log(`   shops: ${tables.has_shops ? '✅' : '❌'}\n`);

    if (!tables.has_transactions || !tables.has_customers || !tables.has_shops) {
      console.log('❌ Missing required tables. Cannot create platform_statistics view.\n');
      return;
    }

    // Drop existing view if it exists
    console.log('🗑️  Dropping existing platform_statistics view (if any)...\n');
    await pool.query('DROP MATERIALIZED VIEW IF EXISTS platform_statistics CASCADE');

    // Create the materialized view
    console.log('📊 Creating platform_statistics materialized view...\n');
    await pool.query(`
      CREATE MATERIALIZED VIEW platform_statistics AS
      SELECT
        -- Token Statistics
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'mint') as total_rcn_minted,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'redeem') as total_rcn_redeemed,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'mint') -
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'redeem') as total_rcn_circulating,

        -- User Statistics
        (SELECT COUNT(DISTINCT wallet_address) FROM customers WHERE is_active = true) as total_active_customers,
        (SELECT COUNT(*) FROM customers WHERE tier = 'bronze' AND is_active = true) as customers_bronze,
        (SELECT COUNT(*) FROM customers WHERE tier = 'silver' AND is_active = true) as customers_silver,
        (SELECT COUNT(*) FROM customers WHERE tier = 'gold' AND is_active = true) as customers_gold,

        -- Shop Statistics
        (SELECT COUNT(*) FROM shops WHERE verified = true AND active = true) as total_active_shops,
        (SELECT COUNT(*) FROM shops WHERE active = true) as shops_with_subscription,

        -- Revenue Statistics (simplified)
        0 as total_revenue,
        0 as revenue_last_30_days,

        -- Transaction Statistics
        (SELECT COUNT(*) FROM transactions) as total_transactions,
        (SELECT COUNT(*) FROM transactions WHERE created_at >= NOW() - INTERVAL '24 hours') as transactions_last_24h,

        -- Referral Statistics
        (SELECT COUNT(*) FROM customers WHERE referred_by IS NOT NULL) as total_referrals,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'tier_bonus') as total_referral_rewards,

        -- Metadata
        NOW() as last_updated
    `);
    console.log('✅ Created platform_statistics materialized view\n');

    // Create unique index for concurrent refresh
    console.log('🔧 Creating unique index for concurrent refresh...\n');
    await pool.query(`
      CREATE UNIQUE INDEX idx_platform_statistics_singleton ON platform_statistics ((1))
    `);
    console.log('✅ Created unique index\n');

    // Update the refresh function - use non-concurrent refresh (safer for singleton views)
    console.log('🔧 Creating refresh_platform_statistics function...\n');
    await pool.query(`
      CREATE OR REPLACE FUNCTION refresh_platform_statistics()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW platform_statistics;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Created refresh_platform_statistics function\n');

    // Test the refresh function
    console.log('🧪 Testing refresh_platform_statistics()...\n');
    await pool.query('SELECT refresh_platform_statistics()');
    console.log('✅ refresh_platform_statistics() works!\n');

    // Show current statistics
    const stats = await pool.query('SELECT * FROM platform_statistics');
    console.log('📊 Current platform statistics:');
    console.log(JSON.stringify(stats.rows[0], null, 2));

    console.log('\n✅ Platform statistics fix completed!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixPlatformStatistics();
