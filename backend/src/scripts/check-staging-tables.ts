#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

async function checkStagingTables() {
  console.log('🔍 Checking staging database tables...\n');

  // Use the DATABASE_URL from staging
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment');
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Check if required tables exist
    const tablesToCheck = [
      'shop_rcn_purchases',
      'revenue_distributions',
      'shops',
      'customers',
      'transactions'
    ];

    console.log('Checking tables:');
    for (const tableName of tablesToCheck) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);

      const exists = result.rows[0].exists;
      console.log(`- ${tableName}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    }

    // Check shop_rcn_purchases columns if table exists
    const purchasesTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'shop_rcn_purchases'
      );
    `);

    if (purchasesTableExists.rows[0].exists) {
      console.log('\n📊 shop_rcn_purchases table structure:');
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'shop_rcn_purchases'
        ORDER BY ordinal_position;
      `);

      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkStagingTables().catch(console.error);