#!/usr/bin/env node

// backend/src/cli/demo-mode.ts
// Manage the demo customer and shop accounts used for Play Store / App Store reviews.
//
// Usage:
//   npm run demo:enable          # Seed iOS + Android demo accounts in DB
//   npm run demo:disable         # Deactivate demo accounts in DB
//   npm run demo:status          # Check current demo mode status
//
// Note: visibility is controlled by DEMO_ENABLE_IOS and DEMO_ENABLE_ANDROID env vars.

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { getSharedPool } from '../utils/database-pool';

const IOS_DEMO_ADDRESS      = '0x00000000000000000000000000000000000de210';
const IOS_DEMO_SHOP_ADDRESS = '0x00000000000000000000000000000000000de510';
const IOS_DEMO_SHOP_ID      = 'demo-shop-00000000000000000000000000000000';

const ANDROID_DEMO_ADDRESS      = '0x00000000000000000000000000000000000de211';
const ANDROID_DEMO_SHOP_ADDRESS = '0x00000000000000000000000000000000000de511';
const ANDROID_DEMO_SHOP_ID      = 'demo-shop-00000000000000000000000000000001';

const DEMO_ACCOUNTS = [
  { platform: 'iOS',     address: IOS_DEMO_ADDRESS,     shopAddress: IOS_DEMO_SHOP_ADDRESS,     shopId: IOS_DEMO_SHOP_ID },
  { platform: 'Android', address: ANDROID_DEMO_ADDRESS, shopAddress: ANDROID_DEMO_SHOP_ADDRESS, shopId: ANDROID_DEMO_SHOP_ID },
];

const chalk = {
  green: (t: string) => `\x1b[32m${t}\x1b[0m`,
  red: (t: string) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t: string) => `\x1b[33m${t}\x1b[0m`,
  cyan: (t: string) => `\x1b[36m${t}\x1b[0m`,
  bold: (t: string) => `\x1b[1m${t}\x1b[0m`,
};

async function ensureDemoCustomer(pool: any, address: string, label: string) {
  const existing = await pool.query(
    'SELECT address, is_active FROM customers WHERE address = $1',
    [address],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  await pool.query(
    `INSERT INTO customers (
      address, wallet_address, name, first_name, last_name,
      email, phone, tier, lifetime_earnings,
      current_rcn_balance, pending_mint_balance, total_redemptions,
      is_active, referral_count, referral_code
    ) VALUES (
      $1, $1, $2, 'Demo', 'User',
      $3, '', 'BRONZE', 150,
      75, 0, 25,
      true, 2, $4
    )`,
    [address, `Demo User (${label})`, `demo-${label.toLowerCase()}@repaircoin.app`, `DEMO${label.toUpperCase().slice(0, 4)}`],
  );

  console.log(chalk.green(`Demo customer (${label}) created in database.`));
  return { address, is_active: true };
}

async function ensureDemoShop(pool: any, shopId: string, shopAddress: string, label: string) {
  const existing = await pool.query(
    'SELECT shop_id, active FROM shops WHERE shop_id = $1',
    [shopId],
  );

  if (existing.rows.length === 0) {
    await pool.query(
      `INSERT INTO shops (
        shop_id, name, address, phone, email, wallet_address,
        reimbursement_address, verified, active,
        total_tokens_issued, total_redemptions, total_reimbursements,
        join_date, last_activity,
        first_name, last_name, country, category, accept_terms
      ) VALUES (
        $1, $2, '123 Demo Street', '', $3, $4,
        $4, true, true,
        500, 120, 0,
        NOW(), NOW(),
        'Demo', 'Shop', 'US', 'Repairs and Tech', true
      )`,
      [shopId, `Demo Shop (${label})`, `demo-shop-${label.toLowerCase()}@repaircoin.app`, shopAddress],
    );
    console.log(chalk.green(`Demo shop (${label}) created in database.`));
  }

  const existingSub = await pool.query(
    `SELECT id FROM shop_subscriptions WHERE shop_id = $1 AND status = 'active' AND is_active = true`,
    [shopId],
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
      [shopId],
    );
    console.log(chalk.green(`Demo shop (${label}) subscription created.`));
  }

  await pool.query(
    `UPDATE shops SET operational_status = 'subscription_qualified' WHERE shop_id = $1`,
    [shopId],
  );

  return { shop_id: shopId, active: true };
}

async function enable() {
  const pool = getSharedPool();
  try {
    for (const { platform, address, shopAddress, shopId } of DEMO_ACCOUNTS) {
      await ensureDemoCustomer(pool, address, platform);
      await pool.query('UPDATE customers SET is_active = true WHERE address = $1', [address]);

      await ensureDemoShop(pool, shopId, shopAddress, platform);
      await pool.query('UPDATE shops SET active = true, verified = true WHERE shop_id = $1', [shopId]);

      console.log(chalk.green(chalk.bold(`[${platform}] Demo accounts seeded.`)));
      console.log(`  Customer: ${chalk.cyan(address)}`);
      console.log(`  Shop ID:  ${chalk.cyan(shopId)}`);
    }
    console.log('');
    console.log(chalk.yellow('To enable visibility, set in backend/.env:'));
    console.log('  DEMO_ENABLE_IOS=true');
    console.log('  DEMO_ENABLE_ANDROID=true');
  } finally {
    await pool.end();
  }
}

async function disable() {
  const pool = getSharedPool();
  try {
    for (const { platform, address, shopId } of DEMO_ACCOUNTS) {
      const existingCustomer = await pool.query(
        'SELECT address FROM customers WHERE address = $1', [address],
      );
      if (existingCustomer.rows.length === 0) {
        console.log(chalk.yellow(`[${platform}] Demo customer does not exist. Skipping.`));
      } else {
        await pool.query('UPDATE customers SET is_active = false WHERE address = $1', [address]);
        console.log(chalk.red(`[${platform}] Demo customer deactivated.`));
      }

      const existingShop = await pool.query(
        'SELECT shop_id FROM shops WHERE shop_id = $1', [shopId],
      );
      if (existingShop.rows.length > 0) {
        await pool.query('UPDATE shops SET active = false WHERE shop_id = $1', [shopId]);
        // Note: subscription is intentionally left active so reviewers retain full feature access.
        console.log(chalk.red(`[${platform}] Demo shop deactivated.`));
      }
    }
    console.log('');
    console.log(chalk.yellow('Also set in backend/.env to hide the demo button:'));
    console.log('  DEMO_ENABLE_IOS=false');
    console.log('  DEMO_ENABLE_ANDROID=false');
  } finally {
    await pool.end();
  }
}

async function status() {
  const pool = getSharedPool();
  try {
    for (const { platform, address, shopId } of DEMO_ACCOUNTS) {
      console.log(chalk.bold(`── ${platform} ──────────────────────────`));

      const customerResult = await pool.query(
        'SELECT address, is_active, name, tier, current_rcn_balance, lifetime_earnings FROM customers WHERE address = $1',
        [address],
      );
      if (customerResult.rows.length === 0) {
        console.log(chalk.yellow('  Demo customer does not exist. Run: npm run demo:enable'));
      } else {
        const row = customerResult.rows[0];
        const state = row.is_active ? chalk.green('active') : chalk.red('inactive');
        console.log(`  Customer [${state}]`);
        console.log(`    Address:  ${chalk.cyan(row.address)}`);
        console.log(`    Tier:     ${row.tier}  Balance: ${row.current_rcn_balance ?? 0} RCN`);
      }

      const shopResult = await pool.query(
        `SELECT s.shop_id, s.active, s.name, s.total_tokens_issued, s.total_redemptions, s.subscription_active
         FROM shops s WHERE s.shop_id = $1`,
        [shopId],
      );
      if (shopResult.rows.length === 0) {
        console.log(chalk.yellow('  Demo shop does not exist. Run: npm run demo:enable'));
      } else {
        const row = shopResult.rows[0];
        const state = row.active ? chalk.green('active') : chalk.red('inactive');
        const subState = row.subscription_active ? chalk.green('active') : chalk.red('inactive');
        console.log(`  Shop     [${state}]  Subscription: [${subState}]`);
        console.log(`    Shop ID: ${chalk.cyan(row.shop_id)}`);
      }

      console.log('');
    }

    const iosEnv = process.env.DEMO_ENABLE_IOS === 'true' ? chalk.green('true') : chalk.red('false');
    const androidEnv = process.env.DEMO_ENABLE_ANDROID === 'true' ? chalk.green('true') : chalk.red('false');
    console.log(chalk.bold('Env vars:'));
    console.log(`  DEMO_ENABLE_IOS     = ${iosEnv}`);
    console.log(`  DEMO_ENABLE_ANDROID = ${androidEnv}`);
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
