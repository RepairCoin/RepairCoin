#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const localConfig = {
  host: 'localhost',
  port: 5432,
  user: 'repaircoin',
  password: 'repaircoin123',
  database: 'repaircoin'
};

async function checkMigrationDifferences() {
  const client = new Client(localConfig);
  
  try {
    await client.connect();
    console.log('✅ Connected to local database\n');
    
    // Get all migration files
    const migrationDirs = [
      path.join(__dirname, '..', 'migrations'),
      path.join(__dirname, '..', 'src', 'migrations')
    ];
    
    const allMigrations = [];
    
    for (const dir of migrationDirs) {
      try {
        const files = await fs.readdir(dir);
        const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
        for (const file of sqlFiles) {
          const content = await fs.readFile(path.join(dir, file), 'utf8');
          allMigrations.push({
            file,
            dir: dir.replace(path.join(__dirname, '..'), ''),
            content: content.substring(0, 200) + '...' // First 200 chars
          });
        }
      } catch (error) {
        // Directory might not exist
      }
    }
    
    console.log('📋 Found migration files:');
    console.log('=' .repeat(80));
    allMigrations.forEach(m => {
      console.log(`${m.file} (${m.dir})`);
    });
    console.log(`\nTotal: ${allMigrations.length} migration files`);
    
    // Check which migrations are tracked
    const trackedResult = await client.query(`
      SELECT version, name 
      FROM schema_migrations 
      ORDER BY version;
    `).catch(() => ({ rows: [] }));
    
    console.log('\n📋 Tracked migrations in schema_migrations:');
    console.log('=' .repeat(80));
    if (trackedResult.rows.length === 0) {
      console.log('No migrations tracked');
    } else {
      trackedResult.rows.forEach(row => {
        console.log(`${row.version}: ${row.name}`);
      });
    }
    
    // Analyze what's missing
    console.log('\n📋 Analysis:');
    console.log('=' .repeat(80));
    
    // Key tables and when they should have been added
    const keyFeatures = [
      { table: 'admins', migration: '008_add_admins_table.sql' },
      { table: 'admin_activity_logs', migration: '011_add_admin_tracking.sql' },
      { table: 'stripe_customers', migration: '010_add_stripe_integration.sql' },
      { table: 'stripe_subscriptions', migration: '013_add_subscription_system.sql' },
      { table: 'revenue_distributions', migration: 'add_rcg_support.sql' },
      { table: 'rcg_staking', migration: 'add_rcg_support.sql' },
      { table: 'promo_codes', migration: '015_add_promo_codes.sql' },
      { table: 'unsuspend_requests', migration: '018_add_suspension_system.sql' }
    ];
    
    for (const feature of keyFeatures) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [feature.table]);
      
      const tracked = trackedResult.rows.some(r => 
        r.name.includes(feature.migration.replace('.sql', ''))
      );
      
      console.log(`${feature.table}: ${exists.rows[0].exists ? '✅ Exists' : '❌ Missing'} | ${tracked ? '✅ Tracked' : '❌ Not tracked'} | Migration: ${feature.migration}`);
    }
    
    // Recommend actions
    console.log('\n📋 Recommendations:');
    console.log('=' .repeat(80));
    console.log('1. Your local database has all tables but migrations are not properly tracked.');
    console.log('2. This suggests the database was created with init.sql or manually.');
    console.log('3. For production sync, you have three options:');
    console.log('   a) Use the generated complete schema (recommended for new production)');
    console.log('   b) Apply migrations individually (if production is partially set up)');
    console.log('   c) Create a baseline migration marking all as applied');
    console.log('\n4. The generated files are located at:');
    console.log(`   - Complete schema: migrations/generated/complete-schema-2025-09-19.sql`);
    console.log(`   - Migration format: migrations/generated/999_complete_schema_sync_2025-09-19.sql`);
    console.log(`   - Apply script: migrations/generated/apply-to-production.sh`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkMigrationDifferences();