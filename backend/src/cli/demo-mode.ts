#!/usr/bin/env node

// backend/src/cli/demo-mode.ts
// Manage the demo customer account used for Play Store / App Store reviews.
//
// Usage:
//   npm run demo:enable          # Create or activate demo customer
//   npm run demo:disable         # Deactivate demo customer (hides button)
//   npm run demo:status          # Check current demo mode status

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { getSharedPool } from '../utils/database-pool';

const DEMO_ADDRESS = '0x00000000000000000000000000000000000de210';

const chalk = {
  green: (t: string) => `\x1b[32m${t}\x1b[0m`,
  red: (t: string) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t: string) => `\x1b[33m${t}\x1b[0m`,
  cyan: (t: string) => `\x1b[36m${t}\x1b[0m`,
  bold: (t: string) => `\x1b[1m${t}\x1b[0m`,
};

async function ensureDemoCustomer(pool: any) {
  const existing = await pool.query(
    'SELECT address, is_active FROM customers WHERE address = $1',
    [DEMO_ADDRESS],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // Create the demo customer
  await pool.query(
    `INSERT INTO customers (
      address, wallet_address, name, first_name, last_name,
      email, phone, tier, lifetime_earnings,
      current_rcn_balance, pending_mint_balance, total_redemptions,
      is_active, referral_count, referral_code
    ) VALUES (
      $1, $1, 'Demo User', 'Demo', 'User',
      'demo@repaircoin.app', '', 'BRONZE', 150,
      75, 0, 25,
      true, 2, 'DEMO0000'
    )`,
    [DEMO_ADDRESS],
  );

  console.log(chalk.green('Demo customer created in database.'));
  return { address: DEMO_ADDRESS, is_active: true };
}

async function enable() {
  const pool = getSharedPool();
  try {
    await ensureDemoCustomer(pool);
    await pool.query(
      'UPDATE customers SET is_active = true WHERE address = $1',
      [DEMO_ADDRESS],
    );
    console.log(chalk.green(chalk.bold('Demo mode ENABLED.')));
    console.log(`  Address: ${chalk.cyan(DEMO_ADDRESS)}`);
    console.log('  The "Explore Demo" button will be visible on the connect screen.');
  } finally {
    await pool.end();
  }
}

async function disable() {
  const pool = getSharedPool();
  try {
    const existing = await pool.query(
      'SELECT address FROM customers WHERE address = $1',
      [DEMO_ADDRESS],
    );
    if (existing.rows.length === 0) {
      console.log(chalk.yellow('Demo customer does not exist. Nothing to disable.'));
      return;
    }
    await pool.query(
      'UPDATE customers SET is_active = false WHERE address = $1',
      [DEMO_ADDRESS],
    );
    console.log(chalk.red(chalk.bold('Demo mode DISABLED.')));
    console.log('  The "Explore Demo" button will be hidden on the connect screen.');
  } finally {
    await pool.end();
  }
}

async function status() {
  const pool = getSharedPool();
  try {
    const result = await pool.query(
      'SELECT address, is_active, name, tier, current_rcn_balance, lifetime_earnings FROM customers WHERE address = $1',
      [DEMO_ADDRESS],
    );
    if (result.rows.length === 0) {
      console.log(chalk.yellow('Demo customer does not exist. Run: npm run demo:enable'));
      return;
    }
    const row = result.rows[0];
    const state = row.is_active ? chalk.green('ENABLED') : chalk.red('DISABLED');
    console.log(chalk.bold(`Demo Mode: ${state}`));
    console.log(`  Address:  ${chalk.cyan(row.address)}`);
    console.log(`  Name:     ${row.name}`);
    console.log(`  Tier:     ${row.tier}`);
    console.log(`  Balance:  ${row.current_rcn_balance ?? 0} RCN`);
    console.log(`  Earnings: ${row.lifetime_earnings ?? 0} RCN`);
  } finally {
    await pool.end();
  }
}

const command = process.argv[2];

switch (command) {
  case 'enable':
    enable().catch(console.error);
    break;
  case 'disable':
    disable().catch(console.error);
    break;
  case 'status':
    status().catch(console.error);
    break;
  default:
    console.log(chalk.bold('Demo Mode Manager'));
    console.log('');
    console.log('Usage:');
    console.log('  npm run demo:enable    Create or activate demo customer');
    console.log('  npm run demo:disable   Deactivate demo customer (hides button)');
    console.log('  npm run demo:status    Check current status');
    break;
}
