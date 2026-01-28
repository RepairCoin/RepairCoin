import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function fixAdminProfile() {
  const walletAddress = '0x7db8b2758d10101310b1add18125adde0d2a2c15';
  const correctName = 'Deo Bernard Cagunot';
  const correctEmail = 'deo.cagunot@gmail.com';

  console.log('=== Fixing Admin Profile ===\n');
  console.log('Wallet:', walletAddress);
  console.log('Correct Name:', correctName);
  console.log('Correct Email:', correctEmail);
  console.log('');

  // Build connection config from individual env vars
  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '25060'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  };

  if (!dbConfig.host) {
    console.error('ERROR: DB_HOST not found in environment');
    process.exit(1);
  }

  console.log('Connecting to:', dbConfig.host);

  const pool = new Pool(dbConfig);

  try {
    // First, show current state
    const currentResult = await pool.query(
      'SELECT id, wallet_address, name, email, role, is_super_admin, is_active, created_at, updated_at FROM admins WHERE LOWER(wallet_address) = LOWER($1)',
      [walletAddress]
    );

    if (currentResult.rows.length === 0) {
      console.log('Admin NOT FOUND in database!');
      console.log('Creating new admin record...');

      await pool.query(
        `INSERT INTO admins (wallet_address, name, email, role, permissions, is_super_admin, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, 'super_admin', '["*"]', true, true, 'SYSTEM', NOW(), NOW())`,
        [walletAddress, correctName, correctEmail]
      );

      console.log('\n✅ Admin record created successfully!');
    } else {
      const currentAdmin = currentResult.rows[0];
      console.log('Current Admin Data:');
      console.log('  ID:', currentAdmin.id);
      console.log('  Wallet:', currentAdmin.wallet_address);
      console.log('  Name:', currentAdmin.name);
      console.log('  Email:', currentAdmin.email);
      console.log('  Role:', currentAdmin.role);
      console.log('  Is Super Admin:', currentAdmin.is_super_admin);
      console.log('  Is Active:', currentAdmin.is_active);
      console.log('');

      // Update with correct data
      console.log('Updating admin profile...');
      await pool.query(
        `UPDATE admins SET
          name = $2,
          email = $3,
          updated_at = NOW()
         WHERE LOWER(wallet_address) = LOWER($1)`,
        [walletAddress, correctName, correctEmail]
      );

      // Verify update
      const updatedResult = await pool.query(
        'SELECT id, wallet_address, name, email, role, is_super_admin FROM admins WHERE LOWER(wallet_address) = LOWER($1)',
        [walletAddress]
      );

      const updatedAdmin = updatedResult.rows[0];
      console.log('\n✅ Admin profile updated successfully!');
      console.log('');
      console.log('Updated Admin Data:');
      console.log('  ID:', updatedAdmin.id);
      console.log('  Wallet:', updatedAdmin.wallet_address);
      console.log('  Name:', updatedAdmin.name);
      console.log('  Email:', updatedAdmin.email);
      console.log('  Role:', updatedAdmin.role);
      console.log('  Is Super Admin:', updatedAdmin.is_super_admin);
    }

    // Log the fix in activity logs
    await pool.query(
      `INSERT INTO admin_activity_logs (admin_address, action_type, action_description, entity_type, entity_id, metadata, created_at)
       VALUES ('SYSTEM', 'profile_fix', 'Restored admin profile name and email', 'admin', $1, $2, NOW())`,
      [walletAddress.toLowerCase(), JSON.stringify({ name: correctName, email: correctEmail, reason: 'Profile overwrite fix' })]
    );

    console.log('\n✅ Activity logged');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixAdminProfile().catch(console.error);
