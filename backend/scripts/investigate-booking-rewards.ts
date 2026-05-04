/**
 * Investigate what RCN was paid out for a specific booking + referee.
 *
 * Usage:
 *   npx ts-node scripts/investigate-booking-rewards.ts <bookingId>
 *
 * Pulls:
 *   - The order (status, amount, customer, shop)
 *   - The customer's full transaction history
 *   - The referral row (if any) where this customer is the referee
 *   - The referrer's recent transactions
 *
 * Read-only. No mutations.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { Pool } from 'pg';

const BOOKING_ID = process.argv[2];
if (!BOOKING_ID) {
  console.error('Usage: npx ts-node scripts/investigate-booking-rewards.ts <bookingId>');
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

(async () => {
  console.log(`Target DB: ${process.env.DB_HOST}`);
  console.log(`Booking: ${BOOKING_ID}\n`);

  const c = await pool.connect();
  try {
    // 1. Find the order — accept full order_id OR BK-XXXXXX short form (matches last 6 chars of order_id, case-insensitive)
    console.log('=== 1. Order (service_orders) ===');
    const bkMatch = BOOKING_ID.match(/^BK-([0-9A-Fa-f]{6})$/);
    const suffix = bkMatch ? bkMatch[1].toLowerCase() : null;
    const orderRes = await c.query(
      `SELECT order_id, customer_address, shop_id, service_id, total_amount,
              status, completed_at, created_at, booking_date, booking_time
       FROM service_orders
       WHERE order_id = $1
          OR ($2::text IS NOT NULL AND LOWER(order_id) LIKE '%' || $2 || '%')`,
      [BOOKING_ID, suffix]
    );
    if (orderRes.rows.length === 0) {
      console.log(`No order found matching '${BOOKING_ID}'.`);
      return;
    }
    const order = orderRes.rows[0];
    for (const [k, v] of Object.entries(order)) {
      console.log(`  ${k.padEnd(20)} ${v ?? '(null)'}`);
    }

    const customerAddress = (order.customer_address as string).toLowerCase();
    const shopId = order.shop_id as string;

    // 2. Customer record
    console.log('\n=== 2. Customer (referee) record ===');
    const customerRes = await c.query(
      `SELECT address, email, name, first_name, last_name, tier,
              referred_by, referral_code, created_at
       FROM customers
       WHERE LOWER(address) = LOWER($1)`,
      [customerAddress]
    );
    if (customerRes.rows.length === 0) {
      console.log(`No customer found at ${customerAddress}.`);
    } else {
      for (const [k, v] of Object.entries(customerRes.rows[0])) {
        console.log(`  ${k.padEnd(20)} ${v ?? '(null)'}`);
      }
    }
    const referredBy = (customerRes.rows[0]?.referred_by || '').toString().toLowerCase();

    // 3. All transactions for this customer
    console.log('\n=== 3. All transactions for referee ===');
    const txRes = await c.query(
      `SELECT id, type, amount, reason, created_at, status, metadata, shop_id
       FROM transactions
       WHERE LOWER(customer_address) = LOWER($1)
       ORDER BY created_at ASC`,
      [customerAddress]
    );
    if (txRes.rows.length === 0) {
      console.log('  (no transactions)');
    } else {
      for (const tx of txRes.rows) {
        console.log(`  [${tx.created_at.toISOString?.() || tx.created_at}] ${tx.type.padEnd(8)} ${String(tx.amount).padStart(8)} | shop=${tx.shop_id ?? '-'} | ${tx.reason}`);
        if (tx.metadata) {
          const m = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
          if (m && Object.keys(m).length > 0) {
            console.log(`     metadata: ${JSON.stringify(m)}`);
          }
        }
      }
      const totalMint = txRes.rows
        .filter((t: any) => t.type === 'mint')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
      console.log(`\n  Total minted: ${totalMint} RCN`);
    }

    // 4. Referral row(s) where this customer is the referee
    console.log('\n=== 4. Referral rows (this customer as referee) ===');
    const refRes = await c.query(
      `SELECT id, referrer_address, referee_address, status, reward_amount,
              referee_bonus, completed_at, created_at, metadata
       FROM referrals
       WHERE LOWER(referee_address) = LOWER($1)
       ORDER BY created_at DESC`,
      [customerAddress]
    );
    if (refRes.rows.length === 0) {
      console.log('  (no referral rows for this customer as referee)');
    } else {
      for (const r of refRes.rows) {
        console.log(`  id=${r.id}`);
        for (const [k, v] of Object.entries(r)) {
          if (k === 'id') continue;
          console.log(`    ${k.padEnd(20)} ${typeof v === 'object' ? JSON.stringify(v) : (v ?? '(null)')}`);
        }
      }
    }

    // 5. Referrer info + recent transactions
    if (referredBy) {
      console.log(`\n=== 5. Referrer record (referred_by = ${referredBy}) ===`);
      const referrerRes = await c.query(
        `SELECT address, email, name, first_name, last_name,
                referral_code, created_at
         FROM customers
         WHERE LOWER(address) = LOWER($1) OR LOWER(referral_code) = LOWER($1)`,
        [referredBy]
      );
      if (referrerRes.rows.length === 0) {
        console.log(`  No referrer found at '${referredBy}'.`);
      } else {
        for (const [k, v] of Object.entries(referrerRes.rows[0])) {
          console.log(`  ${k.padEnd(20)} ${v ?? '(null)'}`);
        }
        const referrerAddr = (referrerRes.rows[0].address as string).toLowerCase();

        console.log(`\n=== 6. Referrer's recent transactions (last 10) ===`);
        const referrerTxRes = await c.query(
          `SELECT id, type, amount, reason, created_at, shop_id
           FROM transactions
           WHERE LOWER(customer_address) = LOWER($1)
           ORDER BY created_at DESC
           LIMIT 10`,
          [referrerAddr]
        );
        if (referrerTxRes.rows.length === 0) {
          console.log('  (no transactions)');
        } else {
          for (const tx of referrerTxRes.rows) {
            console.log(`  [${tx.created_at.toISOString?.() || tx.created_at}] ${tx.type.padEnd(8)} ${String(tx.amount).padStart(8)} | shop=${tx.shop_id ?? '-'} | ${tx.reason}`);
          }
        }
      }
    } else {
      console.log('\n=== 5. Referrer record ===');
      console.log('  (customer.referred_by is null — this customer was not referred)');
    }
  } finally {
    c.release();
    await pool.end();
  }
})();
