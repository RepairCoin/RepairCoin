/**
 * Check and fix admin account for Deo
 *
 * This script:
 * 1. Checks if admin exists in the database
 * 2. Creates or updates the admin if needed
 *
 * Usage: npx ts-node scripts/check-and-fix-admin.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const DEO_ADMIN = {
  walletAddress: '0x7db8b2758d10101310b1aDd18125AddE0d2a2C15',
  email: 'deo.cagunot@gmail.com',
  name: 'Deo Cagunot'
};

async function checkAndFixAdmin() {
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

    // Step 1: Check current admins
    console.log('📋 Step 1: Checking current admins in database...\n');
    const adminsResult = await pool.query(`
      SELECT
        id,
        wallet_address,
        name,
        email,
        role,
        is_active,
        is_super_admin,
        created_at,
        last_login_at
      FROM admins
      ORDER BY id
    `);

    console.log(`Found ${adminsResult.rows.length} admins:\n`);
    adminsResult.rows.forEach((admin, i) => {
      const isTarget = admin.wallet_address.toLowerCase() === DEO_ADMIN.walletAddress.toLowerCase();
      console.log(`${i+1}. ${isTarget ? '👉 ' : '   '}${admin.wallet_address}`);
      console.log(`      Name: ${admin.name || 'N/A'}`);
      console.log(`      Email: ${admin.email || 'N/A'}`);
      console.log(`      Role: ${admin.role || 'N/A'}`);
      console.log(`      Active: ${admin.is_active}`);
      console.log(`      Super Admin: ${admin.is_super_admin}`);
      console.log(`      Last Login: ${admin.last_login_at || 'Never'}\n`);
    });

    // Step 2: Check if Deo's admin exists
    console.log('📋 Step 2: Checking for Deo\'s admin account...\n');
    const deoResult = await pool.query(`
      SELECT * FROM admins
      WHERE LOWER(wallet_address) = LOWER($1)
    `, [DEO_ADMIN.walletAddress]);

    if (deoResult.rows.length > 0) {
      console.log('✅ Deo\'s admin account EXISTS!\n');
      const admin = deoResult.rows[0];
      console.log(`   ID: ${admin.id}`);
      console.log(`   Wallet: ${admin.wallet_address}`);
      console.log(`   Name: ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Active: ${admin.is_active}`);
      console.log(`   Super Admin: ${admin.is_super_admin}`);
      console.log(`   Last Login: ${admin.last_login_at || 'Never'}\n`);

      // Check if it needs updates
      if (!admin.is_active || !admin.is_super_admin) {
        console.log('⚠️  Account needs reactivation...\n');

        await pool.query(`
          UPDATE admins
          SET
            is_active = TRUE,
            is_super_admin = TRUE,
            role = 'super_admin',
            updated_at = NOW()
          WHERE LOWER(wallet_address) = LOWER($1)
        `, [DEO_ADMIN.walletAddress]);

        console.log('✅ Account reactivated!\n');
      }
    } else {
      console.log('❌ Deo\'s admin account NOT FOUND!\n');
      console.log('🔧 Creating admin account...\n');

      // Create the admin account
      await pool.query(`
        INSERT INTO admins (
          wallet_address,
          name,
          email,
          role,
          is_active,
          is_super_admin,
          permissions,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          'super_admin',
          TRUE,
          TRUE,
          $4,
          NOW(),
          NOW()
        )
      `, [
        DEO_ADMIN.walletAddress,
        DEO_ADMIN.name,
        DEO_ADMIN.email,
        JSON.stringify({
          canManageAdmins: true,
          canManageShops: true,
          canManageCustomers: true,
          canManageTokens: true,
          canViewAnalytics: true,
          canModifySettings: true,
          canManageTreasury: true
        })
      ]);

      console.log('✅ Admin account created!\n');
    }

    // Step 3: Verify the fix
    console.log('📋 Step 3: Verifying fix...\n');
    const verifyResult = await pool.query(`
      SELECT
        wallet_address,
        name,
        email,
        role,
        is_active,
        is_super_admin
      FROM admins
      WHERE LOWER(wallet_address) = LOWER($1)
    `, [DEO_ADMIN.walletAddress]);

    if (verifyResult.rows.length > 0) {
      const admin = verifyResult.rows[0];
      console.log('✅ Verification successful!\n');
      console.log(`   Wallet: ${admin.wallet_address}`);
      console.log(`   Name: ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Active: ${admin.is_active}`);
      console.log(`   Super Admin: ${admin.is_super_admin}\n`);
    }

    // Step 4: Check ADMIN_ADDRESSES env var
    console.log('📋 Step 4: Checking ADMIN_ADDRESSES environment variable...\n');
    const adminAddresses = process.env.ADMIN_ADDRESSES || '';
    const addresses = adminAddresses.split(',').map(a => a.trim().toLowerCase());
    const deoInEnv = addresses.includes(DEO_ADMIN.walletAddress.toLowerCase());

    console.log(`   ADMIN_ADDRESSES: ${adminAddresses}\n`);
    console.log(`   Deo's address in env: ${deoInEnv ? '✅ YES' : '❌ NO'}\n`);

    if (!deoInEnv) {
      console.log('⚠️  WARNING: Deo\'s address is NOT in ADMIN_ADDRESSES!\n');
      console.log('   When the server restarts, the admin will be DELETED!\n');
      console.log('   Add this to your .env file:\n');
      console.log(`   ADMIN_ADDRESSES=...,${DEO_ADMIN.walletAddress}\n`);
    }

    // Summary
    console.log('\n📊 Summary:\n');
    console.log('   Root Causes of Admin Deletion:');
    console.log('   1. sync-databases.js / fix-admins.js - These scripts DELETE all admins');
    console.log('      and only copy from NYC database');
    console.log('   2. AdminSyncService.cleanupRemovedAdmins(false) - On server startup,');
    console.log('      any admin NOT in ADMIN_ADDRESSES gets DELETED\n');
    console.log('   Solution:');
    console.log('   - Ensure your address is in ADMIN_ADDRESSES env var');
    console.log('   - Run this script after any database sync\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkAndFixAdmin();
