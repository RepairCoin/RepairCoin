#!/usr/bin/env node

const { Client } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'repaircoin',
  password: 'repaircoin123',
  database: 'repaircoin'
};

async function checkMigrations() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ Connected to local database\n');
    
    // Check if schema_migrations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ No schema_migrations table found!');
      console.log('   This means migrations have not been tracked.');
      console.log('   Run the migration tracking setup first.\n');
    } else {
      // Get applied migrations
      const migrations = await client.query(`
        SELECT version, name, applied_at 
        FROM schema_migrations 
        ORDER BY version;
      `);
      
      if (migrations.rows.length === 0) {
        console.log('⚠️  schema_migrations table exists but is empty.');
        console.log('   No migrations have been recorded as applied.\n');
      } else {
        console.log('📋 Applied migrations in local database:');
        console.log('=' .repeat(70));
        migrations.rows.forEach(row => {
          console.log(`${row.version} | ${row.name} | ${new Date(row.applied_at).toLocaleString()}`);
        });
        console.log('=' .repeat(70));
        console.log(`Total: ${migrations.rows.length} migrations\n`);
      }
    }
    
    // Check for key tables that should exist
    console.log('🔍 Checking for key tables:');
    const keyTables = [
      'customers',
      'shops', 
      'transactions',
      'admins',
      'stripe_customers',
      'stripe_subscriptions',
      'revenue_distributions',
      'rcg_staking',
      'promo_codes'
    ];
    
    for (const table of keyTables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      console.log(`   ${result.rows[0].exists ? '✅' : '❌'} ${table}`);
    }
    
    // Get all tables count
    const allTables = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    `);
    
    console.log(`\n📊 Total tables in local database: ${allTables.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkMigrations();