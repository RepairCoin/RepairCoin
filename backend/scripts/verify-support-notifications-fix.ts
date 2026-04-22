/**
 * Read-only verification script for the "support notifications wrong receiver_address" fix.
 *
 * Background:
 *   Task doc: docs/tasks/shops/bug-support-notifications-wrong-receiver-address.md
 *   Fix commit: 9dbddac0 (Option A — query notifications by [walletAddress, shopId] multi-address)
 *
 *   The fix should make notifications with receiver_address = shopId (like "peanut")
 *   visible to shop users even though the bell queries by the JWT's wallet address.
 *
 * Usage:
 *   # Default — inspect "peanut" shop (from task doc example):
 *   npx ts-node scripts/verify-support-notifications-fix.ts
 *
 *   # Inspect a different shop by shopId / email / wallet address:
 *   npx ts-node scripts/verify-support-notifications-fix.ts peanut
 *   npx ts-node scripts/verify-support-notifications-fix.ts some-shop@example.com
 *   npx ts-node scripts/verify-support-notifications-fix.ts 0xb3afc20c...
 *
 * Safety features:
 *   - Read-only (no INSERT/UPDATE/DELETE anywhere)
 *   - Refuses to run against prod (DB_HOST containing "prod")
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { Pool, PoolClient } from 'pg';

const ARG = process.argv[2] || 'peanut';

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

async function columnExists(client: PoolClient, table: string, column: string): Promise<boolean> {
  const r = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2
     )`,
    [table, column]
  );
  return r.rows[0]?.exists === true;
}

async function listAddressColumnsOnShops(client: PoolClient): Promise<string[]> {
  // Discover which address-like columns exist on shops
  const candidates = [
    'shop_id',
    'wallet_address',
    'owner_address',
    'owner_wallet',
    'embedded_wallet_address',
    'email',
  ];
  const exists: string[] = [];
  for (const col of candidates) {
    if (await columnExists(client, 'shops', col)) exists.push(col);
  }
  return exists;
}

async function findShop(client: PoolClient, identifier: string): Promise<Record<string, any> | null> {
  const availableCols = await listAddressColumnsOnShops(client);
  const whereClauses: string[] = [];
  const params: any[] = [];

  // Try every possible column as a lookup key
  for (const col of availableCols) {
    params.push(identifier);
    whereClauses.push(`LOWER(${col}) = LOWER($${params.length})`);
  }

  if (whereClauses.length === 0) {
    return null;
  }

  const cols = availableCols.join(', ');
  const result = await client.query(
    `SELECT ${cols} FROM shops WHERE ${whereClauses.join(' OR ')} LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

function identitiesFromShop(shop: Record<string, any>): string[] {
  const ids = [
    shop.shop_id,
    shop.wallet_address,
    shop.owner_address,
    shop.owner_wallet,
    shop.embedded_wallet_address,
  ].filter(Boolean);
  // Dedupe, preserving order
  return Array.from(new Set(ids));
}

async function main() {
  console.log(`=== Verify support-notifications fix ===`);
  console.log(`Target DB: ${dbHost}`);
  console.log(`Looking up shop by: "${ARG}"\n`);

  const client = await pool.connect();

  try {
    // Step 1: Find the shop
    const shop = await findShop(client, ARG);

    if (!shop) {
      console.log(`❌ No shop found matching identifier "${ARG}".`);
      console.log(`   Tried columns: shop_id, wallet_address, owner_address, owner_wallet, embedded_wallet_address, email`);
      return;
    }

    console.log('Shop found:');
    for (const [k, v] of Object.entries(shop)) {
      console.log(`  ${k.padEnd(28)} ${v ?? '(null)'}`);
    }
    console.log('');

    // Step 2: Build the identity list
    const identities = identitiesFromShop(shop);
    console.log(`Identities the fix will query by (${identities.length}):`);
    for (const id of identities) {
      console.log(`  - ${id}`);
    }
    console.log('');

    if (identities.length === 0) {
      console.log('⚠️  No identities extracted from shop record — cannot verify.');
      return;
    }

    // Step 3: Count notifications per identity (case-insensitive)
    console.log('Notification counts per identity (case-insensitive on receiver_address):');
    let grandTotal = 0;
    const perIdentityCounts: Array<{ id: string; count: number; unread: number }> = [];
    for (const id of identities) {
      const r = await client.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE is_read = false)::int AS unread
         FROM notifications
         WHERE LOWER(receiver_address) = LOWER($1)`,
        [id]
      );
      const total = r.rows[0]?.total || 0;
      const unread = r.rows[0]?.unread || 0;
      perIdentityCounts.push({ id, count: total, unread });
      grandTotal += total;
      console.log(`  ${id.toString().padEnd(48)} total=${total.toString().padStart(4)}  unread=${unread}`);
    }
    console.log(`  ${'GRAND TOTAL'.padEnd(48)} total=${grandTotal}`);
    console.log('');

    // Step 4: Simulate the fix's multi-address query (case-insensitive ANY)
    // Mirrors: WHERE LOWER(receiver_address) = ANY(LOWER-ed identities)
    const lowerIds = identities.map((i) => i.toString().toLowerCase());
    const fixResult = await client.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE is_read = false)::int AS unread
       FROM notifications
       WHERE LOWER(receiver_address) = ANY($1::text[])`,
      [lowerIds]
    );
    const fixTotal = fixResult.rows[0]?.total || 0;
    const fixUnread = fixResult.rows[0]?.unread || 0;
    console.log('Simulated multi-address query (what the bell should return after the fix):');
    console.log(`  total=${fixTotal}  unread=${fixUnread}`);
    console.log('');

    // Step 5: Case-sensitivity check — does the actual shipped query in the
    // repository do case-insensitive lookup? The repository uses:
    //   WHERE receiver_address = ANY($1)
    // with NO LOWER() wrapper. So if any stored receiver_address has mixed
    // case that doesn't match the JWT's casing, those notifications are invisible.
    console.log('Case-sensitivity check (the shipped query does NOT lowercase — strict equality):');
    const strictResult = await client.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE is_read = false)::int AS unread
       FROM notifications
       WHERE receiver_address = ANY($1::text[])`,
      [identities]
    );
    const strictTotal = strictResult.rows[0]?.total || 0;
    const strictUnread = strictResult.rows[0]?.unread || 0;
    console.log(`  strict (as-is casing)        total=${strictTotal}  unread=${strictUnread}`);
    console.log(`  case-insensitive (simulated) total=${fixTotal}  unread=${fixUnread}`);
    if (strictTotal < fixTotal) {
      console.log(`  ⚠️  CASE-SENSITIVITY GAP: ${fixTotal - strictTotal} notifications`);
      console.log(`     are invisible due to mixed-case receiver_address values.`);
      console.log(`     The shipped repository query does not wrap LOWER() on receiver_address;`);
      console.log(`     it relies on the JWT wallet + shopId matching DB casing exactly.`);
    } else {
      console.log(`  ✓  No case-sensitivity gap — strict query returns same count as case-insensitive.`);
    }
    console.log('');

    // Step 6: Find notifications with unusual receiver_address values associated
    // with this shop that might NOT be in the identity list — these would be the
    // edge-case scenarios where the fix still misses something.
    console.log('Sample distinct receiver_addresses on recent support notifications sent to this shop:');
    // The support notifications the task doc covers: support_ticket_*, support_message_received
    // We search for notifications whose metadata or message references this shop.
    // Since metadata structure varies, we look at distinct receiver_addresses among all
    // notifications created recently with support-related types, to reveal any
    // receiver_address in use that ISN'T in our identity list.
    const distinctReceivers = await client.query(
      `SELECT
         receiver_address,
         COUNT(*)::int AS total,
         MAX(created_at) AS latest
       FROM notifications
       WHERE notification_type LIKE 'support_%'
       GROUP BY receiver_address
       ORDER BY latest DESC NULLS LAST
       LIMIT 20`
    );

    if (distinctReceivers.rows.length === 0) {
      console.log('  (no support_* notifications found in DB)');
    } else {
      console.log(`  ${'receiver_address'.padEnd(48)} ${'count'.padStart(5)}  latest`);
      const identityLowerSet = new Set(lowerIds);
      for (const row of distinctReceivers.rows) {
        const inIdentity = identityLowerSet.has((row.receiver_address || '').toLowerCase());
        const marker = inIdentity ? ' ' : '⚠';
        const latestStr = row.latest ? new Date(row.latest).toISOString().slice(0, 19).replace('T', ' ') : '(none)';
        console.log(
          `  ${marker} ${(row.receiver_address || '(null)').toString().padEnd(46)} ${row.total.toString().padStart(5)}  ${latestStr}`
        );
      }
      console.log('');
      console.log('  ⚠ marker = receiver_address is NOT in the current shop\'s identity list');
      console.log('    (may be a different shop, or this shop has another identity we did not capture)');
    }
    console.log('');

    // Step 7: Latest 5 support notifications for this shop's identities
    console.log('Latest 5 support_* notifications targeted at this shop:');
    const latest = await client.query(
      `SELECT
         notification_type,
         receiver_address,
         is_read,
         created_at,
         LEFT(message, 80) AS preview
       FROM notifications
       WHERE LOWER(receiver_address) = ANY($1::text[])
         AND notification_type LIKE 'support_%'
       ORDER BY created_at DESC
       LIMIT 5`,
      [lowerIds]
    );
    if (latest.rows.length === 0) {
      console.log('  (none)');
    } else {
      for (const row of latest.rows) {
        const when = row.created_at
          ? new Date(row.created_at).toISOString().slice(0, 19).replace('T', ' ')
          : '(no date)';
        const readMark = row.is_read ? '✓' : '•';
        console.log(`  ${readMark} ${when}  ${row.notification_type}  -> ${row.receiver_address}`);
        console.log(`     ${row.preview}`);
      }
    }
    console.log('');

    // Step 8: Verdict
    console.log('===========================================');
    console.log('VERDICT');
    console.log('===========================================');
    if (grandTotal === 0) {
      console.log('No notifications exist for this shop\'s identities. Cannot verify fix with live data.');
      console.log('To test end-to-end: have admin reply to a support ticket for this shop, then re-run.');
    } else {
      console.log(`Expected bell response for this shop (all identities combined): total=${fixTotal}, unread=${fixUnread}`);
      if (strictTotal < fixTotal) {
        console.log(`⚠️  Fix is PARTIAL — ${fixTotal - strictTotal} notifications are still invisible due to case-sensitivity mismatch.`);
        console.log(`   Recommended follow-up: wrap LOWER() around receiver_address in the multi-address repository query.`);
      } else {
        console.log(`✓  Fix covers all notifications for this shop — no casing gaps detected.`);
      }
    }
  } catch (err) {
    console.error('\n❌ Error:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
