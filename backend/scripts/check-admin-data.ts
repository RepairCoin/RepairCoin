import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAdmin() {
  const walletAddress = '0x7db8b2758d10101310b1add18125adde0d2a2c15';

  console.log('=== Checking Admin Data ===\n');

  // Check current state
  const result = await pool.query(
    'SELECT * FROM admins WHERE LOWER(wallet_address) = LOWER($1)',
    [walletAddress]
  );

  if (result.rows.length > 0) {
    const admin = result.rows[0];
    console.log('Current Admin Data:');
    console.log('  ID:', admin.id);
    console.log('  Wallet:', admin.wallet_address);
    console.log('  Name:', admin.name);
    console.log('  Email:', admin.email);
    console.log('  Role:', admin.role);
    console.log('  Is Super Admin:', admin.is_super_admin);
    console.log('  Is Active:', admin.is_active);
    console.log('  Created At:', admin.created_at);
    console.log('  Updated At:', admin.updated_at);
    console.log('  Last Login:', admin.last_login);
  } else {
    console.log('Admin NOT FOUND in database!');
  }

  // Check admin activity logs for this address
  console.log('\n=== Recent Admin Activity Logs ===\n');
  const logs = await pool.query(
    `SELECT action_type, action_description, created_at, metadata
     FROM admin_activity_logs
     WHERE entity_id = $1 OR admin_address = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [walletAddress.toLowerCase()]
  );

  if (logs.rows.length > 0) {
    for (let i = 0; i < logs.rows.length; i++) {
      const log = logs.rows[i];
      console.log((i + 1) + '. [' + log.action_type + '] ' + log.action_description);
      console.log('   Time: ' + log.created_at);
      if (log.metadata) console.log('   Metadata: ' + JSON.stringify(log.metadata));
      console.log('');
    }
  } else {
    console.log('No activity logs found');
  }

  await pool.end();
}

checkAdmin().catch(console.error);
