/**
 * Backfill the `payments` fiat ledger (Payments & Invoicing Center, Phase 0) from the
 * pre-existing per-feature money records, so the Transactions screen has history from day one.
 *
 * Idempotent: every insert is ON CONFLICT DO NOTHING against a partial unique index — the
 * PaymentIntent for Stripe-backed rows, the order for rows settled outside Stripe — so this is
 * safe to re-run. Each source is guarded independently: a schema mismatch on one source logs and
 * skips rather than aborting the whole run.
 *
 * Two later passes close the gaps the SQL sources structurally cannot see (POS S9b):
 *   - orders whose Stripe reference is a Checkout Session, resolved to a PaymentIntent via the API
 *   - orders settled outside Stripe, which have no external record to consult at all
 *
 * Usage:
 *   npx ts-node scripts/backfill-payments.ts            # write
 *   npx ts-node scripts/backfill-payments.ts --dry-run  # report only, no writes
 *   npm run db:backfill-payments
 */

import { Pool } from 'pg';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import { LEDGER_GAP_ROWS_SQL } from '../src/utils/ledgerCompleteness';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

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

interface GapRow {
  order_id: string;
  shop_id: string;
  customer_address: string | null;
  amount_usd: string;
  stripe_payment_intent_id: string | null;
  stripe_session_id: string | null;
  created_at: string;
  gap_class: 'intent' | 'session' | 'none';
  stripe_connect_account_id: string | null;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-08-27.basil' });

/**
 * Resolve a Checkout Session to the PaymentIntent it produced.
 *
 * Direct-charge bookings live on the shop's connected account and platform-era ones live on the
 * platform, with nothing on the order saying which — so try the connected account first and fall
 * back. A session that Stripe reports as anything other than paid returns null on purpose: the
 * order claims money that Stripe has no record of receiving, and inventing a `succeeded` ledger row
 * for it would fabricate revenue. Those surface in the check script for a human to settle.
 */
async function resolveSessionToIntent(row: GapRow): Promise<Stripe.PaymentIntent | null> {
  const sessionId = row.stripe_payment_intent_id?.startsWith('cs_')
    ? row.stripe_payment_intent_id
    : row.stripe_session_id;
  if (!sessionId) return null;

  const attempts: Array<Stripe.RequestOptions | undefined> = row.stripe_connect_account_id
    ? [{ stripeAccount: row.stripe_connect_account_id }, undefined]
    : [undefined];

  for (const opts of attempts) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, opts);
      if (session.payment_status !== 'paid') {
        console.log(
          `   ↷ ${row.order_id}: session ${sessionId} is '${session.payment_status}' in Stripe — order says paid, skipping`
        );
        return null;
      }
      const intentId = session.payment_intent as string | null;
      if (!intentId) {
        console.log(`   ↷ ${row.order_id}: session paid but carries no PaymentIntent, skipping`);
        return null;
      }
      return await stripe.paymentIntents.retrieve(intentId, opts);
    } catch {
      // Wrong account, or the session no longer exists — try the next candidate.
    }
  }
  console.log(`   ↷ ${row.order_id}: session could not be retrieved on any account, skipping`);
  return null;
}

/** Orders whose Stripe reference is a Checkout Session, which the LIKE 'pi_%' sources skip. */
async function backfillCheckoutSessions(gaps: GapRow[]): Promise<number> {
  const rows = gaps.filter((g) => g.gap_class === 'session');
  if (!rows.length) return 0;
  console.log(`\n▸ Checkout Session orders: ${rows.length} to resolve against Stripe`);

  let inserted = 0;
  for (const row of rows) {
    const intent = await resolveSessionToIntent(row);
    if (!intent) continue;
    if (DRY_RUN) {
      console.log(`   • ${row.order_id} → ${intent.id} ($${(intent.amount_received / 100).toFixed(2)})`);
      inserted++;
      continue;
    }
    const result = await pool.query(
      `INSERT INTO payments (
         shop_id, customer_address, order_id, method, source, gross_cents, currency, status,
         stripe_payment_intent_id, stripe_charge_id, stripe_account_id, captured_at, metadata, created_at
       )
       VALUES ($1,$2,$3,'card','booking',$4,$5,'succeeded',$6,$7,$8,$9,$10,$9)
       ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL DO NOTHING`,
      [
        row.shop_id,
        row.customer_address,
        row.order_id,
        // Stripe is authoritative on what was actually collected; the order's amount is what we
        // asked for, and the two can differ once an RCN discount or a partial capture is involved.
        intent.amount_received || intent.amount,
        intent.currency || 'usd',
        intent.id,
        (intent.latest_charge as string) || null,
        row.stripe_connect_account_id,
        new Date(intent.created * 1000).toISOString(),
        JSON.stringify({
          backfill: 'checkout_session',
          resolvedFrom: row.stripe_payment_intent_id?.startsWith('cs_')
            ? row.stripe_payment_intent_id
            : row.stripe_session_id,
        }),
      ]
    );
    inserted += result.rowCount ?? 0;
  }
  console.log(`✅ Checkout Session orders: inserted ${inserted} payment row(s)`);
  return inserted;
}

/**
 * Orders settled outside Stripe — "mark as paid" on a manual booking. No Stripe object exists, so
 * the row is written from the order itself. Fees are zero because cash carries no processing fee
 * and no platform commission: there is no charge to attach an application fee to.
 */
async function backfillManualPayments(gaps: GapRow[]): Promise<number> {
  const rows = gaps.filter((g) => g.gap_class === 'none');
  if (!rows.length) return 0;
  console.log(`\n▸ Orders settled outside Stripe: ${rows.length}`);

  if (DRY_RUN) {
    for (const r of rows) console.log(`   • ${r.order_id} (${r.shop_id}) $${r.amount_usd}`);
    return rows.length;
  }

  let inserted = 0;
  for (const row of rows) {
    const result = await pool.query(
      `INSERT INTO payments (
         shop_id, customer_address, order_id, method, source,
         gross_cents, fee_cents, application_fee_cents, net_cents,
         currency, status, captured_at, metadata, created_at
       )
       VALUES ($1,$2,$3,'cash','booking',$4,0,0,$4,'usd','succeeded',$5,$6,$5)
       ON CONFLICT (order_id) WHERE order_id IS NOT NULL AND stripe_payment_intent_id IS NULL
       DO NOTHING`,
      [
        row.shop_id,
        row.customer_address,
        row.order_id,
        Math.round(parseFloat(row.amount_usd) * 100),
        row.created_at,
        JSON.stringify({ backfill: 'settled_outside_stripe', settledOutsideStripe: true }),
      ]
    );
    inserted += result.rowCount ?? 0;
  }
  console.log(`✅ Orders settled outside Stripe: inserted ${inserted} payment row(s)`);
  return inserted;
}

async function main() {
  if (DRY_RUN) console.log('DRY RUN — no rows will be written\n');

  let total = 0;
  for (const src of SOURCES) {
    if (DRY_RUN) {
      console.log(`⏭  ${src.name}: skipped in dry run (bulk SQL insert)`);
      continue;
    }
    try {
      const result = await pool.query(src.sql);
      console.log(`✅ ${src.name}: inserted ${result.rowCount ?? 0} payment row(s)`);
      total += result.rowCount ?? 0;
    } catch (error) {
      console.error(`⚠️  ${src.name}: skipped (${error instanceof Error ? error.message : error})`);
    }
  }

  // Read the remaining gap AFTER the bulk sources have run, so the pi_ stragglers they just
  // recovered are not queried against Stripe a second time.
  const { rows: gaps } = await pool.query<GapRow>(LEDGER_GAP_ROWS_SQL);
  total += await backfillCheckoutSessions(gaps);
  total += await backfillManualPayments(gaps);

  console.log(`\nDone. ${total} new payment row(s) backfilled.`);
  console.log('Verify with: npm run db:check-ledger');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
