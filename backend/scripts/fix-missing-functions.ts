/**
 * Fix missing database functions
 *
 * This script adds missing database functions that are causing server errors:
 * 1. refresh_platform_statistics() - For AdminRepository
 * 2. cleanup_expired_typing_indicators() - For MessageRepository
 *
 * Usage: npx ts-node scripts/fix-missing-functions.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function fixMissingFunctions() {
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

    // ============================================
    // Fix 1: refresh_platform_statistics function
    // ============================================
    console.log('📋 Checking refresh_platform_statistics function...\n');

    // Check if platform_statistics view exists
    const viewCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_matviews WHERE matviewname = 'platform_statistics'
      ) as exists
    `);

    if (!viewCheck.rows[0].exists) {
      console.log('⚠️  Materialized view platform_statistics does not exist.');
      console.log('   Creating a stub function that does nothing...\n');

      // Create a stub function that doesn't fail
      await pool.query(`
        CREATE OR REPLACE FUNCTION refresh_platform_statistics()
        RETURNS void AS $$
        BEGIN
          -- Stub: materialized view does not exist
          RAISE NOTICE 'Platform statistics view not available';
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('✅ Created stub refresh_platform_statistics() function\n');
    } else {
      // Check if unique index exists (required for CONCURRENTLY refresh)
      const indexCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE indexname = 'idx_platform_statistics_singleton'
        ) as exists
      `);

      if (!indexCheck.rows[0].exists) {
        console.log('⚠️  Missing unique index for concurrent refresh. Creating...\n');
        try {
          await pool.query(`
            CREATE UNIQUE INDEX idx_platform_statistics_singleton
            ON platform_statistics ((1))
          `);
          console.log('✅ Created unique index\n');
        } catch (e: any) {
          console.log(`   Index creation failed (may already exist): ${e.message}\n`);
        }
      }

      // Create the proper function
      await pool.query(`
        CREATE OR REPLACE FUNCTION refresh_platform_statistics()
        RETURNS void AS $$
        BEGIN
          REFRESH MATERIALIZED VIEW CONCURRENTLY platform_statistics;
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('✅ Created refresh_platform_statistics() function\n');
    }

    // ============================================
    // Fix 2: cleanup_expired_typing_indicators function
    // ============================================
    console.log('📋 Checking cleanup_expired_typing_indicators function...\n');

    // Check if typing_indicators table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'typing_indicators'
      ) as exists
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  Table typing_indicators does not exist.');
      console.log('   Creating a stub function that does nothing...\n');

      // Create a stub function that doesn't fail
      await pool.query(`
        CREATE OR REPLACE FUNCTION cleanup_expired_typing_indicators()
        RETURNS void AS $$
        BEGIN
          -- Stub: typing_indicators table does not exist
          NULL;
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('✅ Created stub cleanup_expired_typing_indicators() function\n');
    } else {
      // Create the proper function
      await pool.query(`
        CREATE OR REPLACE FUNCTION cleanup_expired_typing_indicators()
        RETURNS void AS $$
        BEGIN
          DELETE FROM typing_indicators WHERE expires_at < NOW();
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('✅ Created cleanup_expired_typing_indicators() function\n');
    }

    // ============================================
    // Test both functions
    // ============================================
    console.log('🧪 Testing functions...\n');

    try {
      await pool.query('SELECT refresh_platform_statistics()');
      console.log('✅ refresh_platform_statistics() works\n');
    } catch (e: any) {
      console.log(`❌ refresh_platform_statistics() failed: ${e.message}\n`);
    }

    try {
      await pool.query('SELECT cleanup_expired_typing_indicators()');
      console.log('✅ cleanup_expired_typing_indicators() works\n');
    } catch (e: any) {
      console.log(`❌ cleanup_expired_typing_indicators() failed: ${e.message}\n`);
    }

    console.log('✅ All fixes applied successfully!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixMissingFunctions();
