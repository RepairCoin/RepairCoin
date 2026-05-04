/**
 * Safety-gated delete script for a customer by email (removes all related records).
 *
 * Usage:
 *   # DRY RUN:
 *   npx ts-node scripts/delete-customer-by-email.ts anna.cagunot@gmail.com
 *
 *   # EXECUTE:
 *   npx ts-node scripts/delete-customer-by-email.ts anna.cagunot@gmail.com --execute
 *
 * Safety:
 *   - DRY RUN by default; explicit --execute required
 *   - Refuses to run against prod (DB_HOST contains "prod")
 *   - Transaction-wrapped; rolls back on any error
 *
 * Mirrors delete-shop-by-email.ts but adapted for the customers table:
 *   - Customer PK is `address` (lowercased wallet)
 *   - No service_id discovery (customers don't own services)
 *   - FK cleanup focused on per-customer history (orders, reviews, transactions, etc.)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { Pool, PoolClient } from 'pg';

const EMAIL = process.argv[2];
const EXECUTE = process.argv.includes('--execute');

if (!EMAIL) {
  console.error('Usage: npx ts-node scripts/delete-customer-by-email.ts <email> [--execute]');
  process.exit(1);
}

const dbHost = process.env.DB_HOST || '';
if (dbHost.toLowerCase().includes('prod')) {
  console.error('REFUSING TO RUN: DB_HOST contains "prod". Staging only.');
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
  caseInsensitive?: boolean;
}

async function main() {
  console.log(`=== Delete customer by email ===`);
  console.log(`Target DB: ${dbHost}`);
  console.log(`Email: ${EMAIL}`);
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}\n`);

  const c = await pool.connect();

  try {
    await c.query('BEGIN');

    // Step 1 — find the customer
    const customerResult = await c.query(
      `SELECT address, wallet_address, name, first_name, last_name
       FROM customers WHERE LOWER(email) = LOWER($1)`,
      [EMAIL]
    );

    if (customerResult.rows.length === 0) {
      console.log(`No customer with email ${EMAIL}. Nothing to delete.`);
      await c.query('ROLLBACK');
      return;
    }

    const customers = customerResult.rows.map((r) => ({
      address: (r.address as string).toLowerCase(),
      walletAddress: r.wallet_address ? (r.wallet_address as string).toLowerCase() : null,
      name: r.name as string,
      firstName: r.first_name as string,
      lastName: r.last_name as string,
    }));

    console.log(`Found ${customers.length} customer(s):`);
    for (const c of customers) {
      console.log(`  address=${c.address}  name=${c.name || `${c.firstName || ''} ${c.lastName || ''}`}`);
    }
    console.log('');

    // Use both `address` and `wallet_address` as candidate keys — some tables
    // store the customer wallet under different column names.
    const addresses = Array.from(
      new Set(
        customers
          .flatMap((c) => [c.address, c.walletAddress])
          .filter((v): v is string => !!v)
      )
    );

    // Step 2 — enumerate refs to delete, in FK-safe order (children first)
    const refs: Ref[] = [
      // Order-keyed children (delete before service_orders is wiped)
      { table: 'service_reviews', column: 'customer_address', caseInsensitive: true },
      { table: 'review_helpful_votes', column: 'customer_address', caseInsensitive: true },
      { table: 'service_favorites', column: 'customer_address', caseInsensitive: true },
      { table: 'recently_viewed_services', column: 'customer_address', caseInsensitive: true },

      // No-show / appointment history
      { table: 'no_show_history', column: 'customer_address', caseInsensitive: true },
      { table: 'reschedule_requests', column: 'customer_address', caseInsensitive: true },
      { table: 'appointment_reschedule_requests', column: 'customer_address', caseInsensitive: true },
      { table: 'appointments', column: 'customer_address', caseInsensitive: true },

      // Service orders (after children above are gone)
      { table: 'service_orders', column: 'customer_address', caseInsensitive: true },

      // Wallet-keyed generic tables
      { table: 'transactions', column: 'customer_address', caseInsensitive: true },
      { table: 'notifications', column: 'receiver_address', caseInsensitive: true },
      { table: 'notifications', column: 'sender_address', caseInsensitive: true },
      { table: 'push_subscriptions', column: 'user_address', caseInsensitive: true },
      { table: 'device_push_tokens', column: 'wallet_address', caseInsensitive: true },
      { table: 'refresh_tokens', column: 'wallet_address', caseInsensitive: true },

      // Messaging
      { table: 'messages', column: 'sender_address', caseInsensitive: true },
      { table: 'conversations', column: 'customer_address', caseInsensitive: true },

      // Customer blocks (shop side may have blocked this customer)
      { table: 'customer_blocks', column: 'customer_address', caseInsensitive: true },

      // RCN sources (where the customer earned RCN from)
      { table: 'customer_rcn_sources', column: 'customer_address', caseInsensitive: true },

      // Affiliate group memberships and balances
      { table: 'group_token_balances', column: 'customer_address', caseInsensitive: true },
      { table: 'group_token_transactions', column: 'customer_address', caseInsensitive: true },
      { table: 'shop_group_memberships', column: 'customer_address', caseInsensitive: true },

      // Referrals — both as referrer and referee
      { table: 'referrals', column: 'referrer_address', caseInsensitive: true },
      { table: 'referrals', column: 'referee_address', caseInsensitive: true },

      // Idempotency / claim records
      { table: 'idempotency_keys', column: 'wallet_address', caseInsensitive: true },
    ];

    // Step 3 — count what we'd delete
    console.log('Record counts per table:');
    const validRefs: (Ref & { count: number })[] = [];
    for (const ref of refs) {
      if (!(await tableExists(c, ref.table))) continue;
      if (!(await columnExists(c, ref.table, ref.column))) continue;

      const count = await countByIn(c, ref.table, ref.column, addresses, !!ref.caseInsensitive);
      validRefs.push({ ...ref, count });
      if (count > 0) {
        console.log(`  ${ref.table.padEnd(36)} (${ref.column.padEnd(20)}): ${count}`);
      }
    }

    const customersCount = customers.length;
    console.log(`  ${'customers'.padEnd(36)} (${'email'.padEnd(20)}): ${customersCount}`);
    console.log('');

    const totalRelated = validRefs.reduce((sum, r) => sum + r.count, 0);
    const grandTotal = totalRelated + customersCount;
    console.log(`Total rows to delete: ${grandTotal} (${totalRelated} related + ${customersCount} customer)`);
    console.log('');

    if (!EXECUTE) {
      console.log('DRY RUN complete. No changes made.');
      console.log('Re-run with --execute to actually delete.');
      await c.query('ROLLBACK');
      return;
    }

    // Step 4 — EXECUTE
    console.log('EXECUTING DELETES (transaction-wrapped)...\n');
    let deleted = 0;

    for (const ref of validRefs) {
      if (ref.count === 0) continue;
      const n = await deleteByIn(c, ref.table, ref.column, addresses, !!ref.caseInsensitive);
      if (n > 0) {
        console.log(`  ${ref.table.padEnd(36)} (${ref.column.padEnd(20)}): ${n}`);
        deleted += n;
      }
    }

    // Finally: the customer record itself
    const customerDelete = await c.query(
      `DELETE FROM customers WHERE LOWER(email) = LOWER($1)`,
      [EMAIL]
    );
    const nCustomer = customerDelete.rowCount || 0;
    console.log(`  ${'customers'.padEnd(36)} (${'email'.padEnd(20)}): ${nCustomer}`);
    deleted += nCustomer;

    await c.query('COMMIT');
    console.log(`\nDONE. Total deleted: ${deleted}`);
  } catch (err) {
    await c.query('ROLLBACK');
    console.error('\nError — transaction rolled back:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
}

main();
