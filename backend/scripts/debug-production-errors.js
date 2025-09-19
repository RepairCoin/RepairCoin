#!/usr/bin/env node

const { Client } = require('pg');

const prodConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://username:password@host:port/database',
  ssl: {
    rejectUnauthorized: false
  }
};

async function debugProductionErrors() {
  const client = new Client(prodConfig);
  
  try {
    await client.connect();
    console.log('✅ Connected to production database\n');
    
    // 1. Check admin_treasury table
    console.log('🔍 Checking admin_treasury table...');
    try {
      const treasuryResult = await client.query('SELECT * FROM admin_treasury LIMIT 1');
      console.log(`✅ admin_treasury table exists with ${treasuryResult.rows.length} records`);
      if (treasuryResult.rows.length > 0) {
        console.log('   Sample record:', treasuryResult.rows[0]);
      } else {
        console.log('⚠️  admin_treasury table is empty - this might cause API errors');
      }
    } catch (error) {
      console.log('❌ admin_treasury table error:', error.message);
    }
    
    // 2. Check shops table structure
    console.log('\n🔍 Checking shops table structure...');
    try {
      const shopColumnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'shops' 
        ORDER BY ordinal_position
      `);
      console.log(`✅ shops table has ${shopColumnsResult.rows.length} columns:`);
      shopColumnsResult.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });
      
      // Check for specific columns that might be missing
      const requiredColumns = ['operational_status', 'rcg_balance', 'rcg_tier', 'subscription_active'];
      const existingColumns = shopColumnsResult.rows.map(row => row.column_name);
      
      console.log('\n🔍 Checking for required columns:');
      requiredColumns.forEach(col => {
        const exists = existingColumns.includes(col);
        console.log(`   ${exists ? '✅' : '❌'} ${col}`);
      });
      
    } catch (error) {
      console.log('❌ shops table error:', error.message);
    }
    
    // 3. Test a simple shops query
    console.log('\n🔍 Testing shops query...');
    try {
      const shopsResult = await client.query(`
        SELECT shop_id, name, verified, operational_status, rcg_tier, purchased_rcn_balance 
        FROM shops 
        LIMIT 3
      `);
      console.log(`✅ Successfully queried ${shopsResult.rows.length} shops:`);
      shopsResult.rows.forEach(shop => {
        console.log(`   - ${shop.shop_id}: ${shop.name} (${shop.operational_status || 'no status'})`);
      });
    } catch (error) {
      console.log('❌ shops query error:', error.message);
    }
    
    // 4. Check if admins table exists and has data
    console.log('\n🔍 Checking admins table...');
    try {
      const adminsResult = await client.query('SELECT wallet_address, role, status FROM admins LIMIT 5');
      console.log(`✅ admins table exists with ${adminsResult.rows.length} records`);
      adminsResult.rows.forEach(admin => {
        console.log(`   - ${admin.wallet_address}: ${admin.role} (${admin.status})`);
      });
    } catch (error) {
      console.log('❌ admins table error:', error.message);
    }
    
    // 5. Check webhook_logs table structure
    console.log('\n🔍 Checking webhook_logs table...');
    try {
      const webhookResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'webhook_logs' 
        ORDER BY ordinal_position
      `);
      console.log(`✅ webhook_logs table has ${webhookResult.rows.length} columns:`);
      webhookResult.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    } catch (error) {
      console.log('❌ webhook_logs table error:', error.message);
    }
    
    // 6. Initialize admin_treasury if empty
    console.log('\n🔧 Checking if admin_treasury needs initialization...');
    try {
      const treasuryCountResult = await client.query('SELECT COUNT(*) as count FROM admin_treasury');
      if (treasuryCountResult.rows[0].count === '0') {
        console.log('⚠️  admin_treasury is empty, initializing...');
        await client.query(`
          INSERT INTO admin_treasury (
            total_minted, total_burned, total_in_circulation, 
            total_sold_to_shops, total_revenue_usd
          ) VALUES (0, 0, 0, 0, 0)
        `);
        console.log('✅ admin_treasury initialized with default values');
      } else {
        console.log('✅ admin_treasury already has data');
      }
    } catch (error) {
      console.log('❌ admin_treasury initialization error:', error.message);
    }
    
    console.log('\n📋 Summary:');
    console.log('If you see any ❌ errors above, those likely cause the 500 errors in production.');
    console.log('Common fixes:');
    console.log('1. Initialize admin_treasury table with default values');
    console.log('2. Ensure all required columns exist in shops table');
    console.log('3. Check that admin user exists for authentication');
    
  } catch (error) {
    console.error('❌ Connection error:', error.message);
  } finally {
    await client.end();
  }
}

debugProductionErrors();