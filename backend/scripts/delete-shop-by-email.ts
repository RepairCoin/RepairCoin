/**
 * Safety-gated delete script for a shop by email (removes all related records).
 *
 * Usage:
 *   # DRY RUN:
 *   npx ts-node scripts/delete-shop-by-email.ts anna.cagunot@gmail.com
 *
 *   # EXECUTE:
 *   npx ts-node scripts/delete-shop-by-email.ts anna.cagunot@gmail.com --execute
 *
 * Safety:
 *   - DRY RUN by default; explicit --execute required
 *   - Refuses to run against prod (DB_HOST contains "prod")
 *   - Transaction-wrapped; rolls back on any error
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { Pool, PoolClient } from 'pg';

const EMAIL = process.argv[2];
const EXECUTE = process.argv.includes('--execute');

if (!EMAIL) {
  console.error('Usage: npx ts-node scripts/delete-shop-by-email.ts <email> [--execute]');
  process.exit(1);
}

const dbHost = process.env.DB_HOST || '';
if (dbHost.toLowerCase().includes('prod')) {
  console.error('❌ REFUSING TO RUN: DB_HOST contains "prod". Staging only.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function tableExists(c: PoolClient, table: string): Promise<boolean> {
  const r = await c.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
    [table]
  );
  return r.rows[0]?.exists === true;
}

async function columnExists(c: PoolClient, table: string, column: string): Promise<boolean> {
  const r = await c.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2
     )`,
    [table, column]
  );
  return r.rows[0]?.exists === true;
}

async function countByValue(
  c: PoolClient,
  table: string,
  column: string,
  value: string,
  caseInsensitive: boolean
): Promise<number> {
  const where = caseInsensitive
    ? `LOWER(${column}) = LOWER($1)`
    : `${column} = $1`;
  const r = await c.query(`SELECT COUNT(*)::int AS cnt FROM ${table} WHERE ${where}`, [value]);
  return r.rows[0]?.cnt || 0;
}

async function countByIn(
  c: PoolClient,
  table: string,
  column: string,
  values: string[],
  caseInsensitive: boolean
): Promise<number> {
  if (values.length === 0) return 0;
  const vs = caseInsensitive ? values.map((v) => v.toLowerCase()) : values;
  const where = caseInsensitive
    ? `LOWER(${column}) = ANY($1::text[])`
    : `${column} = ANY($1::text[])`;
  const r = await c.query(`SELECT COUNT(*)::int AS cnt FROM ${table} WHERE ${where}`, [vs]);
  return r.rows[0]?.cnt || 0;
}

async function deleteByValue(
  c: PoolClient,
  table: string,
  column: string,
  value: string,
  caseInsensitive: boolean
): Promise<number> {
  const where = caseInsensitive
    ? `LOWER(${column}) = LOWER($1)`
    : `${column} = $1`;
  const r = await c.query(`DELETE FROM ${table} WHERE ${where}`, [value]);
  return r.rowCount || 0;
}

async function deleteByIn(
  c: PoolClient,
  table: string,
  column: string,
  values: string[],
  caseInsensitive: boolean
): Promise<number> {
  if (values.length === 0) return 0;
  const vs = caseInsensitive ? values.map((v) => v.toLowerCase()) : values;
  const where = caseInsensitive
    ? `LOWER(${column}) = ANY($1::text[])`
    : `${column} = ANY($1::text[])`;
  const r = await c.query(`DELETE FROM ${table} WHERE ${where}`, [vs]);
  return r.rowCount || 0;
}

interface Ref {
  table: string;
  column: string;
  key: 'shop_id' | 'wallet' | 'service_id';
  caseInsensitive?: boolean;
}

async function main() {
  console.log(`=== Delete shop by email ===`);
  console.log(`Target DB: ${dbHost}`);
  console.log(`Email: ${EMAIL}`);
  console.log(`Mode: ${EXECUTE ? '🔴 EXECUTE' : '🟢 DRY RUN'}\n`);

  const c = await pool.connect();

  try {
    await c.query('BEGIN');

    // Step 1 — find the shop
    const shopResult = await c.query(
      `SELECT shop_id, wallet_address, name FROM shops WHERE LOWER(email) = LOWER($1)`,
      [EMAIL]
    );

    if (shopResult.rows.length === 0) {
      console.log(`✅ No shop with email ${EMAIL}. Nothing to delete.`);
      await c.query('ROLLBACK');
      return;
    }

    const shops = shopResult.rows.map((r) => ({
      shopId: r.shop_id as string,
      wallet: (r.wallet_address as string).toLowerCase(),
      name: r.name as string,
    }));

    console.log(`Found ${shops.length} shop(s):`);
    for (const s of shops) {
      console.log(`  shop_id=${s.shopId}  wallet=${s.wallet}  name=${s.name}`);
    }
    console.log('');

    const shopIds = shops.map((s) => s.shopId);
    const wallets = shops.map((s) => s.wallet);

    // Step 2 — find service_ids for these shops (needed for review / availability FKs)
    let serviceIds: string[] = [];
    if (await tableExists(c, 'shop_services')) {
      const svcCol = (await columnExists(c, 'shop_services', 'service_id')) ? 'service_id' : null;
      const shopCol = (await columnExists(c, 'shop_services', 'shop_id')) ? 'shop_id' : null;
      if (svcCol && shopCol) {
        const r = await c.query(
          `SELECT ${svcCol} FROM shop_services WHERE ${shopCol} = ANY($1::text[])`,
          [shopIds]
        );
        serviceIds = r.rows.map((row) => row[svcCol] as string);
      }
    }
    if (serviceIds.length > 0) {
      console.log(`Discovered ${serviceIds.length} service(s) under these shop(s):`);
      for (const id of serviceIds) console.log(`  ${id}`);
      console.log('');
    }

    // Step 3 — enumerate refs to delete, in FK-safe order (children first)
    const refs: Ref[] = [
      // Service-keyed children (delete before shop_services is wiped)
      { table: 'service_reviews', column: 'service_id', key: 'service_id' },
      { table: 'service_favorites', column: 'service_id', key: 'service_id' },
      { table: 'recently_viewed_services', column: 'service_id', key: 'service_id' },
      { table: 'review_helpful_votes', column: 'service_id', key: 'service_id' },
      { table: 'service_group_availability', column: 'service_id', key: 'service_id' },

      // Order-keyed children (shop-side); service_orders itself is below
      // Orders by shop_id
      { table: 'service_orders', column: 'shop_id', key: 'shop_id' },
      // Orders by customer_address (shop's wallet is sometimes stored as customer on refunds / edge cases — skip to avoid false-positives)

      // Appointment / reschedule
      { table: 'appointments', column: 'shop_id', key: 'shop_id' },
      { table: 'reschedule_requests', column: 'shop_id', key: 'shop_id' },
      { table: 'appointment_reschedule_requests', column: 'shop_id', key: 'shop_id' },

      // Shop-keyed config tables
      { table: 'shop_availability', column: 'shop_id', key: 'shop_id' },
      { table: 'time_slot_configs', column: 'shop_id', key: 'shop_id' },
      { table: 'shop_email_preferences', column: 'shop_id', key: 'shop_id' },
      { table: 'customer_blocks', column: 'shop_id', key: 'shop_id' },
      { table: 'shop_reports', column: 'shop_id', key: 'shop_id' },
      { table: 'calendar_connections', column: 'shop_id', key: 'shop_id' },
      { table: 'gmail_connections', column: 'shop_id', key: 'shop_id' },
      { table: 'shop_subscriptions', column: 'shop_id', key: 'shop_id' },
      { table: 'stripe_subscriptions', column: 'shop_id', key: 'shop_id' },
      { table: 'shop_group_rcn_allocations', column: 'shop_id', key: 'shop_id' },
      { table: 'shop_group_memberships', column: 'shop_id', key: 'shop_id' },
      { table: 'shop_purchases', column: 'shop_id', key: 'shop_id' },
      { table: 'shop_social_links', column: 'shop_id', key: 'shop_id' },
      { table: 'subscription_enforcement_log', column: 'shop_id', key: 'shop_id' },
      { table: 'unpaid_bookings', column: 'shop_id', key: 'shop_id' },

      // Services table itself (after all service-FK children are gone)
      { table: 'shop_services', column: 'shop_id', key: 'shop_id' },

      // Wallet-keyed generic tables (notifications, transactions)
      { table: 'notifications', column: 'receiver_address', key: 'wallet', caseInsensitive: true },
      { table: 'notifications', column: 'sender_address', key: 'wallet', caseInsensitive: true },
      { table: 'transactions', column: 'customer_address', key: 'wallet', caseInsensitive: true },
      { table: 'transactions', column: 'shop_id', key: 'shop_id' },

      // Notifications addressed by shop_id string (support-notifications multi-address fix)
      { table: 'notifications', column: 'receiver_address', key: 'shop_id' },
      { table: 'notifications', column: 'sender_address', key: 'shop_id' },

      // Push tokens
      { table: 'push_subscriptions', column: 'user_address', key: 'wallet', caseInsensitive: true },
      { table: 'device_push_tokens', column: 'wallet_address', key: 'wallet', caseInsensitive: true },

      // Refresh tokens
      { table: 'refresh_tokens', column: 'wallet_address', key: 'wallet', caseInsensitive: true },

      // Support tickets
      { table: 'support_messages', column: 'sender_id', key: 'shop_id' },
      { table: 'support_tickets', column: 'shop_id', key: 'shop_id' },

      // Messaging
      { table: 'messages', column: 'sender_address', key: 'wallet', caseInsensitive: true },
      { table: 'conversations', column: 'shop_address', key: 'wallet', caseInsensitive: true },
      { table: 'conversations', column: 'customer_address', key: 'wallet', caseInsensitive: true },
    ];

    // Step 4 — count what we'd delete
    console.log('Record counts per table:');
    const validRefs: (Ref & { count: number; values: string[] })[] = [];
    for (const ref of refs) {
      if (!(await tableExists(c, ref.table))) {
        console.log(`  ⊘  ${ref.table} (${ref.column}): table missing`);
        continue;
      }
      if (!(await columnExists(c, ref.table, ref.column))) {
        console.log(`  ⊘  ${ref.table} (${ref.column}): column missing`);
        continue;
      }
      const values =
        ref.key === 'shop_id' ? shopIds :
        ref.key === 'wallet' ? wallets :
        ref.key === 'service_id' ? serviceIds :
        [];
      if (values.length === 0) {
        continue; // e.g., no service_ids found — skip
      }
      const count = await countByIn(c, ref.table, ref.column, values, !!ref.caseInsensitive);
      validRefs.push({ ...ref, count, values });
      const marker = count > 0 ? '  •' : '   ';
      console.log(`${marker}  ${ref.table} (${ref.column}, by ${ref.key}): ${count}`);
    }

    const shopsCount = shops.length;
    console.log(`  •  shops (email): ${shopsCount}`);
    console.log('');

    const totalRelated = validRefs.reduce((sum, r) => sum + r.count, 0);
    const grandTotal = totalRelated + shopsCount;
    console.log(`Total rows to delete: ${grandTotal} (${totalRelated} related + ${shopsCount} shop)`);
    console.log('');

    if (!EXECUTE) {
      console.log('DRY RUN complete. No changes made.');
      console.log('Re-run with --execute to actually delete.');
      await c.query('ROLLBACK');
      return;
    }

    // Step 5 — EXECUTE
    console.log('🔴 EXECUTING DELETES (transaction-wrapped)...\n');
    let deleted = 0;

    for (const ref of validRefs) {
      const n = await deleteByIn(c, ref.table, ref.column, ref.values, !!ref.caseInsensitive);
      if (n > 0) {
        console.log(`  ✓  ${ref.table} (${ref.column}): ${n}`);
        deleted += n;
      }
    }

    // Finally: the shop record itself
    const shopDelete = await c.query(
      `DELETE FROM shops WHERE LOWER(email) = LOWER($1)`,
      [EMAIL]
    );
    const nShop = shopDelete.rowCount || 0;
    console.log(`  ✓  shops: ${nShop}`);
    deleted += nShop;

    await c.query('COMMIT');
    console.log(`\n✅ DONE. Total deleted: ${deleted}`);
  } catch (err) {
    await c.query('ROLLBACK');
    console.error('\n❌ Error — transaction rolled back:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
}

main();
