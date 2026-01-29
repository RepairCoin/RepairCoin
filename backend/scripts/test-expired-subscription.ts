/**
 * Test expired subscription by temporarily modifying a shop's subscription dates.
 * Handles ALL stripe_subscriptions records for the shop (not just the latest).
 *
 * Usage:
 *   npx ts-node scripts/test-expired-subscription.ts expire <shop_id>
 *   npx ts-node scripts/test-expired-subscription.ts restore <shop_id>
 *
 * Example:
 *   npx ts-node scripts/test-expired-subscription.ts expire dc_shopu
 *   npx ts-node scripts/test-expired-subscription.ts restore dc_shopu
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const action = process.argv[2];
  const shopId = process.argv[3];

  if (!action || !shopId || !['expire', 'restore'].includes(action)) {
    console.log('Usage: npx ts-node scripts/test-expired-subscription.ts <expire|restore> <shop_id>');
    process.exit(1);
  }

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

  const pool = new Pool(config);

  try {
    // Find shop by shop_id
    const shopResult = await pool.query(
      'SELECT shop_id, name, operational_status FROM shops WHERE shop_id = $1',
      [shopId]
    );

    if (shopResult.rows.length === 0) {
      console.error(`❌ Shop not found with shop_id: ${shopId}`);
      process.exit(1);
    }

    const shop = shopResult.rows[0];
    console.log(`\n🏪 Shop: ${shop.name}, ID: ${shop.shop_id}`);
    console.log(`   Operational status: ${shop.operational_status}`);

    // Get ALL stripe subscription records
    const allStripeSubs = await pool.query(
      'SELECT id, status, current_period_end, cancel_at_period_end, canceled_at FROM stripe_subscriptions WHERE shop_id = $1 ORDER BY created_at DESC',
      [shopId]
    );

    const shopSub = await pool.query(
      'SELECT id, status, next_payment_date, is_active, cancelled_at FROM shop_subscriptions WHERE shop_id = $1 ORDER BY enrolled_at DESC LIMIT 1',
      [shopId]
    );

    if (allStripeSubs.rows.length === 0) {
      console.error('❌ No stripe_subscriptions records found');
      process.exit(1);
    }

    const shopSubscription = shopSub.rows[0];

    console.log(`\n📋 Current state (${allStripeSubs.rows.length} stripe subscription records):`);
    allStripeSubs.rows.forEach((r: any) => {
      console.log(`   [ID ${r.id}] status=${r.status}, period_end=${r.current_period_end}, cancel_at_period_end=${r.cancel_at_period_end}`);
    });
    if (shopSubscription) {
      console.log(`   shop_subscriptions: status=${shopSubscription.status}, next_payment=${shopSubscription.next_payment_date}, is_active=${shopSubscription.is_active}`);
    }

    if (action === 'expire') {
      // Save backup of ALL records
      const backup = {
        stripeRecords: allStripeSubs.rows.map((r: any) => ({
          id: r.id,
          status: r.status,
          current_period_end: r.current_period_end,
          cancel_at_period_end: r.cancel_at_period_end,
          canceled_at: r.canceled_at,
        })),
        shop: shopSubscription ? {
          id: shopSubscription.id,
          status: shopSubscription.status,
          next_payment_date: shopSubscription.next_payment_date,
          is_active: shopSubscription.is_active,
          cancelled_at: shopSubscription.cancelled_at,
        } : null,
        operational_status: shop.operational_status,
      };

      // Save backup to metadata on the latest record
      const latestId = allStripeSubs.rows[0].id;
      await pool.query(
        `UPDATE stripe_subscriptions SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ _test_backup: backup }), latestId]
      );

      // Expire ALL stripe subscriptions for this shop
      const pastDate = new Date('2025-01-01T00:00:00Z');
      await pool.query(
        `UPDATE stripe_subscriptions SET status = 'canceled', current_period_end = $1, cancel_at_period_end = false, canceled_at = NOW() WHERE shop_id = $2`,
        [pastDate, shopId]
      );

      if (shopSubscription) {
        await pool.query(
          `UPDATE shop_subscriptions SET status = 'cancelled', next_payment_date = $1, is_active = false, cancelled_at = NOW() WHERE shop_id = $2`,
          [pastDate, shopId]
        );
      }

      await pool.query(
        `UPDATE shops SET operational_status = 'not_qualified' WHERE shop_id = $1`,
        [shopId]
      );

      console.log(`\n✅ All ${allStripeSubs.rows.length} subscriptions expired!`);
      console.log('   stripe_subscriptions: ALL set to status=canceled, period_end=2025-01-01');
      console.log('   shop_subscriptions: status=cancelled, is_active=false');
      console.log('   shops: operational_status=not_qualified');
      console.log('\n📌 Backup saved to stripe_subscriptions.metadata._test_backup');
      console.log(`\n🔄 To restore: npx ts-node scripts/test-expired-subscription.ts restore ${shopId}`);

    } else if (action === 'restore') {
      // Read backup from metadata on the latest record
      const latestId = allStripeSubs.rows[0].id;
      const metaResult = await pool.query(
        `SELECT metadata->'_test_backup' as backup FROM stripe_subscriptions WHERE id = $1`,
        [latestId]
      );

      const backup = metaResult.rows[0]?.backup;
      if (!backup) {
        console.error('❌ No backup found in metadata. Was this subscription expired using this script?');
        process.exit(1);
      }

      // Restore ALL stripe_subscriptions records
      for (const record of backup.stripeRecords) {
        await pool.query(
          `UPDATE stripe_subscriptions SET status = $1, current_period_end = $2, cancel_at_period_end = $3, canceled_at = $4 WHERE id = $5`,
          [record.status, record.current_period_end, record.cancel_at_period_end, record.canceled_at, record.id]
        );
      }
      console.log(`\n✅ Restored ${backup.stripeRecords.length} stripe subscription records`);

      // Restore shop_subscriptions
      if (backup.shop) {
        await pool.query(
          `UPDATE shop_subscriptions SET status = $1, next_payment_date = $2, is_active = $3, cancelled_at = $4 WHERE id = $5`,
          [backup.shop.status, backup.shop.next_payment_date, backup.shop.is_active, backup.shop.cancelled_at, backup.shop.id]
        );
        console.log(`   shop_subscriptions: status=${backup.shop.status}, is_active=${backup.shop.is_active}`);
      }

      // Restore operational_status
      await pool.query(
        `UPDATE shops SET operational_status = $1 WHERE shop_id = $2`,
        [backup.operational_status, shopId]
      );
      console.log(`   shops: operational_status=${backup.operational_status}`);

      // Clean up backup from metadata
      await pool.query(
        `UPDATE stripe_subscriptions SET metadata = metadata - '_test_backup' WHERE id = $1`,
        [latestId]
      );

      console.log('\n✅ Subscription fully restored!');
      backup.stripeRecords.forEach((r: any) => {
        console.log(`   [ID ${r.id}] status=${r.status}, period_end=${r.current_period_end}`);
      });
    }
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

main();
