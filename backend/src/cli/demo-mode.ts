#!/usr/bin/env node

// backend/src/cli/demo-mode.ts
// Manage the demo customer and shop accounts used for Play Store / App Store reviews.
//
// Usage:
//   npm run demo:enable          # Create or activate demo customer + shop
//   npm run demo:disable         # Deactivate demo accounts (hides button)
//   npm run demo:status          # Check current demo mode status

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { getSharedPool } from '../utils/database-pool';

const DEMO_ADDRESS = '0x00000000000000000000000000000000000de210';
const DEMO_SHOP_ADDRESS = '0x00000000000000000000000000000000000de510';
const DEMO_SHOP_ID = 'demo-shop-00000000000000000000000000000000';

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

async function ensureDemoShop(pool: any) {
  const existing = await pool.query(
    'SELECT shop_id, active FROM shops WHERE shop_id = $1',
    [DEMO_SHOP_ID],
  );

  if (existing.rows.length === 0) {
    // Create the demo shop
    await pool.query(
      `INSERT INTO shops (
        shop_id, name, address, phone, email, wallet_address,
        reimbursement_address, verified, active,
        total_tokens_issued, total_redemptions, total_reimbursements,
        join_date, last_activity,
        first_name, last_name, country, category, accept_terms
      ) VALUES (
        $1, 'Demo Shop', '123 Demo Street', '', 'demo-shop@repaircoin.app', $2,
        $2, true, true,
        500, 120, 0,
        NOW(), NOW(),
        'Demo', 'Shop', 'US', 'Repairs and Tech', true
      )`,
      [DEMO_SHOP_ID, DEMO_SHOP_ADDRESS],
    );
    console.log(chalk.green('Demo shop created in database.'));
  }

  // Ensure an active subscription exists for the demo shop
  const existingSub = await pool.query(
    `SELECT id FROM shop_subscriptions WHERE shop_id = $1 AND status = 'active' AND is_active = true`,
    [DEMO_SHOP_ID],
  );

  if (existingSub.rows.length === 0) {
    await pool.query(
      `INSERT INTO shop_subscriptions (
        shop_id, status, monthly_amount, subscription_type,
        payments_made, total_paid, is_active,
        enrolled_at, activated_at, next_payment_date
      ) VALUES (
        $1, 'active', 500.00, 'standard',
        1, 500.00, true,
        NOW(), NOW(), NOW() + INTERVAL '30 days'
      )`,
      [DEMO_SHOP_ID],
    );
    console.log(chalk.green('Demo shop subscription created.'));
  }

  // Ensure operational_status reflects the active subscription
  await pool.query(
    `UPDATE shops SET operational_status = 'subscription_qualified' WHERE shop_id = $1`,
    [DEMO_SHOP_ID],
  );

  return { shop_id: DEMO_SHOP_ID, active: true };
}

async function enable() {
  const pool = getSharedPool();
  try {
    await ensureDemoCustomer(pool);
    await pool.query(
      'UPDATE customers SET is_active = true WHERE address = $1',
      [DEMO_ADDRESS],
    );

    await ensureDemoShop(pool);
    await pool.query(
      'UPDATE shops SET active = true, verified = true WHERE shop_id = $1',
      [DEMO_SHOP_ID],
    );

    console.log(chalk.green(chalk.bold('Demo mode ENABLED.')));
    console.log(`  Customer address: ${chalk.cyan(DEMO_ADDRESS)}`);
    console.log(`  Shop ID:          ${chalk.cyan(DEMO_SHOP_ID)}`);
    console.log('  The "Explore Demo" button will be visible on the connect screen.');
  } finally {
    await pool.end();
  }
}

async function disable() {
  const pool = getSharedPool();
  try {
    const existingCustomer = await pool.query(
      'SELECT address FROM customers WHERE address = $1',
      [DEMO_ADDRESS],
    );
    if (existingCustomer.rows.length === 0) {
      console.log(chalk.yellow('Demo customer does not exist. Nothing to disable.'));
    } else {
      await pool.query(
        'UPDATE customers SET is_active = false WHERE address = $1',
        [DEMO_ADDRESS],
      );
    }

    const existingShop = await pool.query(
      'SELECT shop_id FROM shops WHERE shop_id = $1',
      [DEMO_SHOP_ID],
    );
    if (existingShop.rows.length > 0) {
      await pool.query(
        'UPDATE shops SET active = false WHERE shop_id = $1',
        [DEMO_SHOP_ID],
      );
      // Note: subscription is intentionally left active so Apple/Play Store reviewers
      // retain full feature access even when demo mode is disabled.
    }

    console.log(chalk.red(chalk.bold('Demo mode DISABLED.')));
    console.log('  The "Explore Demo" button will be hidden on the connect screen.');
  } finally {
    await pool.end();
  }
}

async function status() {
  const pool = getSharedPool();
  try {
    const customerResult = await pool.query(
      'SELECT address, is_active, name, tier, current_rcn_balance, lifetime_earnings FROM customers WHERE address = $1',
      [DEMO_ADDRESS],
    );
    if (customerResult.rows.length === 0) {
      console.log(chalk.yellow('Demo customer does not exist. Run: npm run demo:enable'));
    } else {
      const row = customerResult.rows[0];
      const state = row.is_active ? chalk.green('ENABLED') : chalk.red('DISABLED');
      console.log(chalk.bold(`Demo Customer: ${state}`));
      console.log(`  Address:  ${chalk.cyan(row.address)}`);
      console.log(`  Name:     ${row.name}`);
      console.log(`  Tier:     ${row.tier}`);
      console.log(`  Balance:  ${row.current_rcn_balance ?? 0} RCN`);
      console.log(`  Earnings: ${row.lifetime_earnings ?? 0} RCN`);
    }

    console.log('');

    const shopResult = await pool.query(
      `SELECT s.shop_id, s.active, s.name, s.total_tokens_issued, s.total_redemptions, s.subscription_active
       FROM shops s WHERE s.shop_id = $1`,
      [DEMO_SHOP_ID],
    );
    if (shopResult.rows.length === 0) {
      console.log(chalk.yellow('Demo shop does not exist. Run: npm run demo:enable'));
    } else {
      const row = shopResult.rows[0];
      const state = row.active ? chalk.green('ENABLED') : chalk.red('DISABLED');
      const subState = row.subscription_active ? chalk.green('active') : chalk.red('inactive');
      console.log(chalk.bold(`Demo Shop:     ${state}`));
      console.log(`  Shop ID:         ${chalk.cyan(row.shop_id)}`);
      console.log(`  Name:            ${row.name}`);
      console.log(`  Subscription:    ${subState}`);
      console.log(`  Tokens Issued:   ${row.total_tokens_issued ?? 0} RCN`);
      console.log(`  Redemptions:     ${row.total_redemptions ?? 0}`);
    }
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
