/**
 * Fail loudly when a shop is billed twice, or is treated as paying with no cover behind it.
 *
 * Both faults are silent. A shop with two live Stripe subscriptions is charged twice a month and
 * nothing in the product says so; a shop whose Stripe cover lapsed keeps full access as long as our
 * own row still reads active. Neither raises an error, so neither surfaces until someone reads a
 * statement or a bug report arrives.
 *
 * Duplicates are CONFIRMED against Stripe before being reported. The mirror is only a mirror: a row
 * that is stale in our database but cancelled at Stripe is a reconciliation problem, not money
 * leaving anyone's account, and calling it double billing would send someone chasing the wrong
 * thing. Without STRIPE_SECRET_KEY the check still runs and says plainly that it could not confirm.
 *
 * Exits 1 when anything is found, so it can be wired into CI or a post-deploy step.
 *
 * Usage:
 *   npx ts-node scripts/check-subscription-integrity.ts
 *   npm run db:check-subs
 */

import { Pool } from 'pg';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import {
  DUPLICATE_LIVE_SUBS_SQL,
  ACTIVE_WITHOUT_COVER_SQL,
} from '../src/utils/subscriptionIntegrity';

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

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const LIVE = new Set(['active', 'trialing', 'past_due']);

const day = (value: unknown): string =>
  value ? new Date(value as string).toISOString().slice(0, 10) : '—';

interface Confirmed {
  id: string;
  status: string;
  monthly: string;
}

async function confirmAgainstStripe(ids: string[]): Promise<Confirmed[] | null> {
  if (!stripe) return null;
  const confirmed: Confirmed[] = [];
  for (const id of ids) {
    try {
      const sub = await stripe.subscriptions.retrieve(id);
      if (!LIVE.has(sub.status)) continue;
      const price = sub.items?.data?.[0]?.price;
      confirmed.push({
        id,
        status: sub.status,
        monthly: price?.unit_amount != null ? `$${price.unit_amount / 100}` : '?',
      });
    } catch {
      // Unknown to Stripe — a mirror row with no counterpart. Not billing anyone.
    }
  }
  return confirmed;
}

async function main(): Promise<void> {
  console.log(
    `Stripe: ${
      stripeKey
        ? stripeKey.startsWith('sk_live')
          ? 'LIVE mode'
          : 'test mode'
        : 'no key — duplicates cannot be confirmed'
    }\n`
  );

  let failed = false;

  const duplicates = (await pool.query(DUPLICATE_LIVE_SUBS_SQL)).rows;
  if (duplicates.length === 0) {
    console.log('✅ No shop has more than one live subscription.');
  } else {
    for (const row of duplicates) {
      const confirmed = await confirmAgainstStripe(row.subscription_ids);

      if (confirmed === null) {
        failed = true;
        console.log(
          `⚠️  ${row.shop_name} (${row.shop_id}): ${row.live_rows} live rows in our mirror — unconfirmed`
        );
        row.subscription_ids.forEach((id: string) => console.log(`      ${id}`));
        continue;
      }

      if (confirmed.length <= 1) {
        console.log(
          `ℹ️  ${row.shop_name} (${row.shop_id}): ${row.live_rows} mirror rows but ${confirmed.length} live at Stripe — stale mirror, nobody is billed twice.`
        );
        continue;
      }

      failed = true;
      console.log(
        `❌ ${row.shop_name} (${row.shop_id}) is billed ${confirmed.length}× — Stripe confirms:`
      );
      confirmed.forEach((c) => console.log(`      ${c.id}  ${c.status}  ${c.monthly}/mo`));
    }
  }

  const uncovered = (await pool.query(ACTIVE_WITHOUT_COVER_SQL)).rows;
  console.log('');
  if (uncovered.length === 0) {
    console.log('✅ Every shop we treat as paying has live cover behind it.');
  } else {
    failed = true;
    console.log(`❌ ${uncovered.length} shop(s) treated as paying with no live Stripe cover:`);
    uncovered.forEach((r) => {
      // "Never paid" and "stopped paying" look identical in operational_status and need opposite
      // conversations, so the payment history is on the line rather than a click away.
      const paid = Number(r.payments_made ?? 0) > 0 || Number(r.total_paid ?? 0) > 0;
      console.log(
        `      ${r.shop_name} (${r.shop_id})  status=${r.operational_status}` +
          `  plan=${r.subscription_type ?? '—'}  stripe=${r.stripe_status ?? 'no row'}` +
          `  cover_ended=${day(r.stripe_period_end)}` +
          `  ${paid ? `paid=${r.payments_made ?? 0}×/$${Number(r.total_paid ?? 0).toFixed(2)}` : 'NEVER PAID'}`
      );
    });
    console.log(
      '\n   These shops have full access without cover. One that never paid is an enrolment that\n' +
        '   was never completed; one that stopped is a lapsed customer. Reinstating or closing the\n' +
        '   row is a billing decision, not a data fix.'
    );
  }

  if (failed) {
    console.log(
      '\n❌ Subscription state does not reconcile with Stripe.\n' +
        '   A duplicate confirmed by Stripe is money being taken twice; cancelling the redundant\n' +
        '   subscription is irreversible and belongs to whoever owns the billing relationship.'
    );
    process.exitCode = 1;
  } else {
    console.log('\n✅ Subscriptions reconcile with Stripe.');
  }
}

main()
  .catch((e) => {
    console.error('Subscription integrity check failed to run:', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
