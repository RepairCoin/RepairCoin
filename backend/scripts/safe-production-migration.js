#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const prodConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://username:password@host:port/database',
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
};

async function analyzeProdData() {
  const client = new Client(prodConfig);
  const timestamp = new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, '..', 'migrations', 'production-analysis');
  
  try {
    await client.connect();
    console.log('✅ Connected to production database\n');
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    let migrationSQL = `-- Safe Production Migration Plan
-- Generated on ${new Date().toISOString()}
-- This preserves existing production data while adding new features

BEGIN;

-- Step 1: Create schema_migrations table for tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

`;

    // Analyze production-only tables
    console.log('📊 Analyzing production-only tables...\n');
    
    const prodOnlyTables = ['admin_logs', 'earning_transactions', 'wallet_registrations'];
    
    for (const table of prodOnlyTables) {
      const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`Table: ${table}`);
      console.log(`  Records: ${countResult.rows[0].count}`);
      
      if (countResult.rows[0].count > 0) {
        // Get sample data
        const sampleResult = await client.query(`SELECT * FROM ${table} LIMIT 5`);
        console.log(`  Sample columns: ${Object.keys(sampleResult.rows[0] || {}).join(', ')}`);
        
        // Add migration comment
        migrationSQL += `
-- Preserve existing ${table} data (${countResult.rows[0].count} records)
-- TODO: Decide if this data should be migrated to new schema
-- ALTER TABLE ${table} RENAME TO ${table}_backup;
`;
      }
      console.log('');
    }
    
    // Check existing data in shared tables
    console.log('📊 Analyzing shared tables...\n');
    
    const sharedTables = ['customers', 'shops', 'transactions', 'referrals'];
    let dataAnalysis = '';
    
    for (const table of sharedTables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        dataAnalysis += `${table}: ${countResult.rows[0].count} records\n`;
        console.log(`${table}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`${table}: Error reading - ${error.message}`);
      }
    }
    
    // Create safe migration plan
    migrationSQL += `
-- Step 2: Backup existing tables with data
CREATE TABLE customers_backup AS SELECT * FROM customers;
CREATE TABLE shops_backup AS SELECT * FROM shops;
CREATE TABLE transactions_backup AS SELECT * FROM transactions;
CREATE TABLE referrals_backup AS SELECT * FROM referrals;

-- Step 3: Add missing columns to existing tables (safe alterations)
`;

    // Analyze what columns need to be added
    const alterations = [
      { table: 'customers', columns: [
        'auth_method VARCHAR(50)',
        'email_verified BOOLEAN DEFAULT false',
        'home_shop_id VARCHAR(100)',
        'suspended_at TIMESTAMP',
        'suspension_reason TEXT',
        'wallet_type VARCHAR(50)'
      ]},
      { table: 'shops', columns: [
        'operational_status VARCHAR(50) DEFAULT \'pending\'',
        'rcg_balance NUMERIC(18,2) DEFAULT 0',
        'rcg_tier VARCHAR(20) DEFAULT \'standard\'',
        'subscription_active BOOLEAN DEFAULT false',
        'suspended_at TIMESTAMP',
        'suspension_reason TEXT'
      ]}
    ];
    
    for (const alt of alterations) {
      migrationSQL += `\n-- Add missing columns to ${alt.table}\n`;
      for (const col of alt.columns) {
        migrationSQL += `ALTER TABLE ${alt.table} ADD COLUMN IF NOT EXISTS ${col};\n`;
      }
    }
    
    // Add new tables
    migrationSQL += `
-- Step 4: Create new tables (these don't exist in production)
`;
    
    // Read the complete schema and extract only new tables
    const completeSchemaPath = path.join(__dirname, '..', 'migrations', 'generated', 'complete-schema-2025-09-19.sql');
    let completeSchema = '';
    try {
      completeSchema = await fs.readFile(completeSchemaPath, 'utf8');
    } catch (error) {
      console.log('⚠️  Could not read complete schema file');
    }
    
    // List of new tables to create
    const newTables = [
      'admins', 'admin_activity_logs', 'admin_alerts',
      'stripe_customers', 'stripe_subscriptions', 'stripe_subscription_events',
      'stripe_payment_methods', 'stripe_payment_attempts',
      'promo_codes', 'promo_code_uses',
      'rcg_staking', 'revenue_distributions',
      'customer_wallets', 'cross_shop_verifications',
      'tier_bonuses', 'token_sources'
    ];
    
    migrationSQL += `
-- Creating ${newTables.length} new tables...
-- (Include the CREATE TABLE statements from complete-schema-2025-09-19.sql for these tables)

`;

    // Add data migration steps
    migrationSQL += `
-- Step 5: Data migrations for compatibility

-- Map wallet_registrations to customers if needed
-- INSERT INTO customers (wallet_address, ...) 
-- SELECT ... FROM wallet_registrations 
-- WHERE ... ON CONFLICT DO NOTHING;

-- Map earning_transactions to transactions if needed
-- INSERT INTO transactions (...)
-- SELECT ... FROM earning_transactions
-- WHERE ... ON CONFLICT DO NOTHING;

-- Step 6: Create indexes and constraints
-- (Include from complete schema)

-- Step 7: Record migration
INSERT INTO schema_migrations (version, name) VALUES 
  (1000, 'production_sync_${timestamp}');

COMMIT;

-- Post-migration verification queries
-- SELECT COUNT(*) FROM customers WHERE wallet_address IN (SELECT wallet_address FROM customers_backup);
-- SELECT COUNT(*) FROM shops WHERE shop_id IN (SELECT shop_id FROM shops_backup);
`;

    // Write migration plan
    const migrationFile = path.join(outputDir, `safe-migration-${timestamp}.sql`);
    await fs.writeFile(migrationFile, migrationSQL);
    
    // Write analysis report
    const reportContent = `# Production Database Analysis Report
Generated: ${new Date().toISOString()}

## Current Production State
- Total tables: 13
- Database appears to be an older version

## Data Summary
${dataAnalysis}

## Production-Only Tables
- admin_logs: Legacy admin logging
- earning_transactions: May need to migrate to transactions table
- wallet_registrations: May need to migrate to customers table

## Missing Critical Features
1. Admin system (admins, admin_activity_logs)
2. Stripe integration (all payment tables)
3. Promo codes system
4. RCG governance token support
5. Modern subscription system

## Migration Strategy
1. Backup all existing data
2. Add missing columns to existing tables
3. Create new tables for missing features
4. Migrate data from legacy tables
5. Update application code to use new schema

## Risk Assessment
- LOW: Adding new tables (no impact on existing)
- MEDIUM: Adding columns to existing tables (app compatibility)
- HIGH: Modifying column types (requires careful testing)

## Recommended Approach
1. Take full database backup
2. Test migration on staging environment
3. Schedule maintenance window
4. Apply migration with rollback plan ready
5. Verify all features post-migration
`;
    
    const reportFile = path.join(outputDir, `analysis-report-${timestamp}.md`);
    await fs.writeFile(reportFile, reportContent);
    
    console.log(`\n✅ Analysis complete!`);
    console.log(`📄 Migration plan: ${migrationFile}`);
    console.log(`📄 Analysis report: ${reportFile}`);
    
    // Create backup script
    const backupScript = `#!/bin/bash
# Backup production database before migration

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
echo "Creating production backup..."

pg_dump '${prodConfig.connectionString}' > "production_backup_\${TIMESTAMP}.sql"

echo "Backup completed: production_backup_\${TIMESTAMP}.sql"
echo "To restore: psql '${prodConfig.connectionString}' < production_backup_\${TIMESTAMP}.sql"
`;
    
    const backupFile = path.join(outputDir, 'backup-production.sh');
    await fs.writeFile(backupFile, backupScript);
    await fs.chmod(backupFile, '755');
    
    console.log(`📄 Backup script: ${backupFile}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeProdData();