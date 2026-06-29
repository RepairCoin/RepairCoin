/**
 * Backfill subscription_payment_ledger from Stripe and recompute
 * shop_subscriptions.payments_made / total_paid.
 *
 * Stripe is the source of truth: for every shop_subscription with a Stripe
 * billing_reference, every paid invoice (including the initial subscription_create)
 * is inserted into the ledger (ON CONFLICT DO NOTHING), then the counters are
 * recomputed from the ledger. Safe to run repeatedly and alongside live webhooks.
 *
 * Usage:
 *   ts-node scripts/backfill-subscription-payments.ts [--dry-run] [--shop=<shopId>]
 */
import Stripe from 'stripe';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const SHOP_FILTER = process.argv.find((a) => a.startsWith('--shop='))?.split('=')[1];

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
});

interface SubRow {
  id: number;
  shop_id: string;
  billing_reference: string;
}

async function main() {
  console.log(`\n=== BACKFILL SUBSCRIPTION PAYMENTS ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const params: any[] = [];
  let where = `billing_reference LIKE 'sub_%'`;
  if (SHOP_FILTER) {
    params.push(SHOP_FILTER);
    where += ` AND shop_id = $1`;
  }

  const subs = await pool.query<SubRow>(
    `SELECT id, shop_id, billing_reference
     FROM shop_subscriptions
     WHERE ${where}
     ORDER BY id ASC`,
    params
  );

  console.log(`Found ${subs.rows.length} Stripe-backed subscription(s) to scan\n`);

  let totalInvoices = 0;
  let inserted = 0;
  let skippedDuplicate = 0;
  let missingInStripe = 0;
  let failedSubs = 0;
  const touchedSubIds: number[] = [];

  for (const sub of subs.rows) {
    const subId = sub.billing_reference;
    process.stdout.write(`Shop ${sub.shop_id} (sub ${subId})... `);

    try {
      let count = 0;
      for await (const invoice of stripe.invoices.list({
        subscription: subId,
        status: 'paid',
        limit: 100,
      })) {
        totalInvoices++;
        count++;

        const amountCents = invoice.amount_paid ?? 0;
        const paidAtTs = invoice.status_transitions?.paid_at ?? invoice.created;
        const processedAt = new Date(paidAtTs * 1000);

        if (DRY_RUN) {
          inserted++;
          continue;
        }

        const res = await pool.query(
          `INSERT INTO subscription_payment_ledger (
             stripe_invoice_id, shop_subscription_id, shop_id,
             stripe_subscription_id, amount_cents, billing_reason, processed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (stripe_invoice_id) DO NOTHING
           RETURNING stripe_invoice_id`,
          [
            invoice.id,
            sub.id,
            sub.shop_id,
            subId,
            amountCents,
            invoice.billing_reason ?? null,
            processedAt,
          ]
        );
        if (res.rowCount && res.rowCount > 0) inserted++;
        else skippedDuplicate++;
      }

      touchedSubIds.push(sub.id);
      console.log(`${count} paid invoice(s)`);
    } catch (err) {
      if ((err as any)?.code === 'resource_missing') {
        missingInStripe++;
        console.log('not in Stripe (skipped)');
      } else {
        failedSubs++;
        console.log(`FAILED: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }

  if (!DRY_RUN && touchedSubIds.length > 0) {
    const recompute = await pool.query(
      `UPDATE shop_subscriptions s
       SET payments_made = l.cnt,
           total_paid = l.total,
           last_payment_date = l.last_paid
       FROM (
         SELECT shop_subscription_id,
                COUNT(*) AS cnt,
                SUM(amount_cents) / 100.0 AS total,
                MAX(processed_at) AS last_paid
         FROM subscription_payment_ledger
         WHERE shop_subscription_id = ANY($1)
         GROUP BY shop_subscription_id
       ) l
       WHERE s.id = l.shop_subscription_id`,
      [touchedSubIds]
    );
    console.log(`\nRecomputed counters for ${recompute.rowCount} subscription(s).`);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Subscriptions scanned: ${subs.rows.length}`);
  console.log(`Paid invoices seen:    ${totalInvoices}`);
  console.log(`Ledger rows inserted:  ${inserted}`);
  console.log(`Already in ledger:     ${skippedDuplicate}`);
  console.log(`Not in Stripe:         ${missingInStripe}`);
  console.log(`Failed subscriptions:  ${failedSubs}`);
  if (DRY_RUN) console.log(`\n(DRY RUN — no rows written, no counters changed)`);

  await pool.end();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
