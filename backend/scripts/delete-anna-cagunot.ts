/**
 * Safety-gated delete script for anna.cagunot@gmail.com test records.
 *
 * Usage:
 *   # DRY RUN (default) — shows what would be deleted, makes no changes:
 *   npx ts-node scripts/delete-anna-cagunot.ts
 *
 *   # EXECUTE — actually deletes. Requires --execute flag:
 *   npx ts-node scripts/delete-anna-cagunot.ts --execute
 *
 * Safety features:
 *   - DRY RUN by default
 *   - Explicit --execute flag required
 *   - Targets STAGING DB only (refuses if DB_HOST contains "prod")
 *   - Runs in a transaction; rolls back on any error
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { Pool, PoolClient } from 'pg';

const TARGET_EMAIL = 'anna.cagunot@gmail.com';
const EXECUTE = process.argv.includes('--execute');

// Safety: refuse to run against prod
const dbHost = process.env.DB_HOST || '';
if (dbHost.toLowerCase().includes('prod')) {
  console.error('❌ REFUSING TO RUN: DB_HOST contains "prod". This script is staging-only.');
  console.error(`   DB_HOST: ${dbHost}`);
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

async function findCustomerAddresses(client: PoolClient): Promise<string[]> {
  const result = await client.query(
    `SELECT address FROM customers WHERE LOWER(email) = LOWER($1)`,
    [TARGET_EMAIL]
  );
  return result.rows.map(r => r.address);
}

async function countInTable(
  client: PoolClient,
  table: string,
  column: string,
  addresses: string[]
): Promise<number> {
  if (addresses.length === 0) return 0;
  const result = await client.query(
    `SELECT COUNT(*)::int AS cnt FROM ${table} WHERE LOWER(${column}) = ANY($1::text[])`,
    [addresses.map(a => a.toLowerCase())]
  );
  return result.rows[0]?.cnt || 0;
}

async function tableExists(client: PoolClient, table: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
    [table]
  );
  return result.rows[0]?.exists === true;
}

async function columnExists(client: PoolClient, table: string, column: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2
     )`,
    [table, column]
  );
  return result.rows[0]?.exists === true;
}

async function deleteByAddressColumn(
  client: PoolClient,
  table: string,
  column: string,
  addresses: string[]
): Promise<number> {
  if (addresses.length === 0) return 0;
  const exists = await tableExists(client, table);
  if (!exists) {
    console.log(`  ⊘  ${table}: table does not exist, skipping`);
    return 0;
  }
  const result = await client.query(
    `DELETE FROM ${table} WHERE LOWER(${column}) = ANY($1::text[])`,
    [addresses.map(a => a.toLowerCase())]
  );
  return result.rowCount || 0;
}

async function main() {
  console.log(`=== Delete test records for ${TARGET_EMAIL} ===`);
  console.log(`Target DB: ${dbHost}`);
  console.log(`Mode: ${EXECUTE ? '🔴 EXECUTE (will delete)' : '🟢 DRY RUN (no changes)'}`);
  console.log('');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: Find customer addresses for this email
    const addresses = await findCustomerAddresses(client);

    if (addresses.length === 0) {
      console.log(`✅ No customers found with email ${TARGET_EMAIL}. Nothing to delete.`);
      await client.query('ROLLBACK');
      return;
    }

    console.log(`Found ${addresses.length} customer record(s) with email ${TARGET_EMAIL}:`);
    for (const addr of addresses) {
      console.log(`  - ${addr}`);
    }
    console.log('');

    // Step 2: Inventory related records (for both dry-run and execute paths)
    // Tables and the column that links to customer address
    const customerAddressRefs: Array<{ table: string; column: string }> = [
      { table: 'service_orders', column: 'customer_address' },
      { table: 'customer_rcn_sources', column: 'customer_address' },
      { table: 'conversations', column: 'customer_address' },
      { table: 'notifications', column: 'receiver_address' },
      { table: 'notifications', column: 'sender_address' },
      { table: 'appointments', column: 'customer_address' },
      { table: 'reviews', column: 'customer_address' },
      { table: 'service_favorites', column: 'customer_address' },
      { table: 'recently_viewed_services', column: 'customer_address' },
      { table: 'referrals', column: 'referrer_address' },
      { table: 'referrals', column: 'referee_address' },
      { table: 'customer_blocks', column: 'customer_address' },
      { table: 'reschedule_requests', column: 'customer_address' },
      { table: 'messages', column: 'sender_address' },
      { table: 'messages', column: 'receiver_address' },
      { table: 'email_preferences', column: 'customer_address' },
      { table: 'push_subscriptions', column: 'user_address' },
      { table: 'transactions', column: 'customer_address' },
      { table: 'transactions', column: 'from_address' },
      { table: 'transactions', column: 'to_address' },
    ];

    console.log('Related record counts:');
    const validRefs: Array<{ table: string; column: string }> = [];
    for (const ref of customerAddressRefs) {
      const tExists = await tableExists(client, ref.table);
      if (!tExists) {
        console.log(`  ⊘  ${ref.table} (${ref.column}): table does not exist`);
        continue;
      }
      const cExists = await columnExists(client, ref.table, ref.column);
      if (!cExists) {
        console.log(`  ⊘  ${ref.table} (${ref.column}): column does not exist`);
        continue;
      }
      const count = await countInTable(client, ref.table, ref.column, addresses);
      validRefs.push(ref);
      const marker = count > 0 ? '  •' : '   ';
      console.log(`${marker}  ${ref.table} (${ref.column}): ${count}`);
    }
    console.log('');

    if (!EXECUTE) {
      console.log('DRY RUN complete. No changes made.');
      console.log('To actually delete, re-run with --execute');
      await client.query('ROLLBACK');
      return;
    }

    // Step 3: EXECUTE — delete in FK-safe order (children first, customer last)
    console.log('🔴 EXECUTING DELETES (transaction-wrapped — rollback on any error)...\n');

    let totalDeleted = 0;
    for (const ref of validRefs) {
      const deleted = await deleteByAddressColumn(client, ref.table, ref.column, addresses);
      if (deleted > 0) {
        console.log(`  ✓  ${ref.table} (${ref.column}): deleted ${deleted}`);
        totalDeleted += deleted;
      }
    }

    // Finally, delete the customer record itself
    const customerResult = await client.query(
      `DELETE FROM customers WHERE LOWER(email) = LOWER($1)`,
      [TARGET_EMAIL]
    );
    const customerDeleted = customerResult.rowCount || 0;
    console.log(`  ✓  customers: deleted ${customerDeleted}`);
    totalDeleted += customerDeleted;

    await client.query('COMMIT');
    console.log(`\n✅ DONE. Total rows deleted: ${totalDeleted}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error — transaction rolled back:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
