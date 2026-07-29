/**
 * Backfill the `payments` fiat ledger (Payments & Invoicing Center, Phase 0) from the
 * pre-existing per-feature money records, so the Transactions screen has history from day one.
 *
 * Idempotent: every insert is ON CONFLICT (stripe_payment_intent_id) DO NOTHING against the
 * partial unique index, so this is safe to re-run. Each source is guarded independently — a
 * schema mismatch on one source logs and skips rather than aborting the whole run.
 *
 * Usage:
 *   npx ts-node scripts/backfill-payments.ts
 *   npm run db:backfill-payments
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL;
const ssl =
  (url && url.includes('sslmode=require')) ||
  process.env.DB_SSL === 'true' ||
  (process.env.DB_HOST || '').includes('digitalocean')
    ? { rejectUnauthorized: false }
    : false;

const pool = new Pool(
  url
    ? { connectionString: url, ssl }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl,
      }
);

// The partial unique index means we can only rely on ON CONFLICT for rows WITH a PaymentIntent,
// so every source is filtered to real "pi_..." references.
const SOURCES: Array<{ name: string; sql: string }> = [
  {
    name: 'service_orders (bookings)',
    sql: `
      INSERT INTO payments (
        shop_id, customer_address, order_id, method, source,
        gross_cents, currency, status, stripe_payment_intent_id, captured_at, metadata, created_at
      )
      SELECT
        shop_id, customer_address, order_id, 'card', 'booking',
        ROUND(COALESCE(final_amount_usd, total_amount, 0) * 100)::int,
        'usd',
        CASE WHEN status = 'refunded' THEN 'refunded' ELSE 'succeeded' END,
        stripe_payment_intent_id,
        created_at,
        jsonb_build_object('backfill', 'service_orders', 'orderStatus', status),
        created_at
      FROM service_orders
      WHERE stripe_payment_intent_id LIKE 'pi_%'
      ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL DO NOTHING`,
  },
  {
    name: 'deposit_transactions',
    sql: `
      INSERT INTO payments (
        shop_id, method, source, gross_cents, currency, status,
        stripe_payment_intent_id, stripe_charge_id, captured_at, metadata, created_at
      )
      SELECT
        shop_id, 'deposit', 'deposit',
        ROUND(COALESCE(amount, 0) * 100)::int,
        'usd',
        CASE WHEN status = 'refunded' THEN 'refunded' ELSE 'succeeded' END,
        stripe_payment_intent_id, stripe_charge_id,
        charged_at,
        jsonb_build_object('backfill', 'deposit_transactions', 'depositStatus', status),
        COALESCE(charged_at, now())
      FROM deposit_transactions
      WHERE stripe_payment_intent_id LIKE 'pi_%'
      ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL DO NOTHING`,
  },
  {
    name: 'shop_rcn_purchases',
    sql: `
      INSERT INTO payments (
        shop_id, method, source, gross_cents, currency, status,
        stripe_payment_intent_id, captured_at, metadata, created_at
      )
      SELECT
        shop_id, 'card', 'rcn_purchase',
        ROUND(COALESCE(total_cost, 0) * 100)::int,
        'usd', 'succeeded',
        payment_reference,
        created_at,
        jsonb_build_object('backfill', 'shop_rcn_purchases'),
        created_at
      FROM shop_rcn_purchases
      WHERE payment_reference LIKE 'pi_%'
      ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL DO NOTHING`,
  },
];

async function main() {
  let total = 0;
  for (const src of SOURCES) {
    try {
      const result = await pool.query(src.sql);
      console.log(`✅ ${src.name}: inserted ${result.rowCount ?? 0} payment row(s)`);
      total += result.rowCount ?? 0;
    } catch (error) {
      console.error(`⚠️  ${src.name}: skipped (${error instanceof Error ? error.message : error})`);
    }
  }
  console.log(`\nDone. ${total} new payment row(s) backfilled.`);
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
