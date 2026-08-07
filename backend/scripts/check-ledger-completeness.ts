/**
 * Fail loudly when a paid booking has no row in the fiat `payments` ledger (POS S9b).
 *
 * Since S9a the shop dashboard's revenue tile reads `payments`, so a missing ledger row is money
 * the shop took and is never shown. The gap is invisible by construction — nothing errors, a number
 * is quietly smaller — so it needs an assertion rather than a dashboard nobody checks.
 *
 * Exits 1 when any gap remains, so it can be wired into CI or a post-deploy step.
 *
 * Usage:
 *   npx ts-node scripts/check-ledger-completeness.ts
 *   npm run db:check-ledger
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import {
  LEDGER_GAP_ROWS_SQL,
  LEDGER_GAP_SUMMARY_SQL,
  LEDGER_COVERED_JOIN,
} from '../src/utils/ledgerCompleteness';
import { revenueRecognized } from '../src/utils/sqlFragments';

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

const REMEDY: Record<string, string> = {
  intent: 'has a PaymentIntent, needs only a backfill run',
  session: 'Checkout Session reference; recoverable unless Stripe reports the session unpaid',
  none: 'settled outside Stripe, written from the order',
};

async function main() {
  const coverage = await pool.query(
    `SELECT count(*)::int AS recognized,
            count(*) FILTER (WHERE p.id IS NULL)::int AS missing,
            COALESCE(sum(COALESCE(o.final_amount_usd, o.total_amount, 0)), 0)::numeric(12,2) AS recognized_usd,
            COALESCE(sum(COALESCE(o.final_amount_usd, o.total_amount, 0))
                     FILTER (WHERE p.id IS NULL), 0)::numeric(12,2) AS missing_usd
     FROM service_orders o
     ${LEDGER_COVERED_JOIN}
     WHERE ${revenueRecognized('o')}`
  );
  const { recognized, missing, recognized_usd, missing_usd } = coverage.rows[0];

  console.log('Fiat ledger completeness (paid bookings vs `payments`)');
  console.log('──────────────────────────────────────────────────────');
  console.log(`  paid bookings      : ${recognized}  ($${recognized_usd})`);
  console.log(`  missing from ledger: ${missing}  ($${missing_usd})`);

  if (missing === 0) {
    console.log('\n✅ Every paid booking has a ledger row.');
    return;
  }

  const summary = await pool.query(LEDGER_GAP_SUMMARY_SQL);
  console.log('\nBy how it can be closed (run: npm run db:backfill-payments):');
  for (const r of summary.rows) {
    console.log(`  ${r.gap_class.padEnd(8)} ${String(r.orders).padStart(4)} orders  $${r.usd}  — ${REMEDY[r.gap_class] ?? ''}`);
  }

  const { rows } = await pool.query(LEDGER_GAP_ROWS_SQL);
  console.log('\nOrders (most recent first):');
  console.table(
    rows.slice(0, 40).map((r: any) => ({
      order_id: r.order_id,
      shop: r.shop_id,
      usd: r.amount_usd,
      status: r.status,
      class: r.gap_class,
      stripe_ref: r.stripe_payment_intent_id || r.stripe_session_id || '—',
    }))
  );
  if (rows.length > 40) console.log(`  …and ${rows.length - 40} more`);

  console.log(
    '\n❌ The ledger is incomplete. Revenue read from `payments` is under-reported by the amount above.'
  );
  console.log(
    '   A gap that survives a backfill means the order claims money Stripe has no record of —\n' +
      '   that is an order to correct, not a ledger row to write.'
  );
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('Ledger completeness check failed to run:', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
