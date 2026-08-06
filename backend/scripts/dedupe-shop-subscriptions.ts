/**
 * Cancel the redundant subscriptions of shops that are billed more than once.
 *
 * Three shops reached this state before the checkout guard existed: a second checkout opened
 * before the first webhook landed passed a check that only asked our own mirror, so Stripe ended up
 * with two or three live subscriptions billing the same shop in parallel.
 *
 * DRY RUN BY DEFAULT — the opposite of backfill-payments.ts, deliberately. That script writes rows
 * nobody misses if they arrive twice; this one cancels a customer's subscription, which is
 * irreversible and immediately visible on their account. Nothing happens without --apply.
 *
 * What survives: the most valuable plan first (a shop paying $599 and $500 keeps the $599),
 * then the furthest-reaching billing period, then the newest. The survivor is never touched, so the
 * shop keeps continuous service throughout.
 *
 * Refunds are NOT handled. The shop has already been charged for periods it was double-billed, and
 * whether to refund is a decision about a customer relationship — the invoice of each cancelled
 * subscription is printed so it can be acted on separately.
 *
 * Agency Program subscriptions are excluded: they bill on the owner shop's same Stripe customer but
 * are a different product, so a shop legitimately holds one alongside its plan.
 *
 * Usage:
 *   npx ts-node scripts/dedupe-shop-subscriptions.ts              # report only
 *   npx ts-node scripts/dedupe-shop-subscriptions.ts --apply      # cancel, test mode
 *   npx ts-node scripts/dedupe-shop-subscriptions.ts --apply --live-mode-confirmed
 *   npm run stripe:dedupe-subs
 */

import { Pool } from 'pg';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import { DUPLICATE_LIVE_SUBS_SQL } from '../src/utils/subscriptionIntegrity';
// Same rule the subscription.created webhook applies, so a duplicate caught live and one cleaned up
// afterwards can never disagree about which subscription the shop keeps.
import { chooseSubscriptionToKeep } from '../src/utils/subscriptionSurvivor';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const LIVE_CONFIRMED = process.argv.includes('--live-mode-confirmed');

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
const IS_LIVE = !!stripeKey?.startsWith('sk_live');
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

interface Candidate {
  id: string;
  status: string;
  amountCents: number;
  periodEnd: number;
  created: number;
  latestInvoice: string | null;
}

const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
const day = (unix: number): string =>
  unix ? new Date(unix * 1000).toISOString().slice(0, 10) : '—';

async function main(): Promise<void> {
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY is not set — nothing to talk to.');
    process.exitCode = 1;
    return;
  }

  const stripe = new Stripe(stripeKey);

  console.log(`Stripe: ${IS_LIVE ? 'LIVE MODE' : 'test mode'}`);
  console.log(APPLY ? 'Mode:   APPLY — subscriptions will be cancelled' : 'Mode:   dry run — nothing will be cancelled');

  if (APPLY && IS_LIVE && !LIVE_CONFIRMED) {
    console.error(
      '\nRefusing to cancel live subscriptions without --live-mode-confirmed.\n' +
        'This charges real customers and cannot be undone. Read the dry run first.'
    );
    process.exitCode = 1;
    return;
  }

  const shops = (await pool.query(DUPLICATE_LIVE_SUBS_SQL)).rows;
  if (shops.length === 0) {
    console.log('\n✅ No shop has more than one live subscription.');
    return;
  }

  let cancelled = 0;
  let monthlySaved = 0;

  for (const shop of shops) {
    const candidates: Candidate[] = [];

    for (const id of shop.subscription_ids as string[]) {
      try {
        const sub = await stripe.subscriptions.retrieve(id);
        if (!LIVE_STATUSES.has(sub.status)) continue;
        // Belt and braces: the mirror should never hold one of these, and if it somehow does,
        // cancelling a shop's Agency Program while deduplicating its plan would be a bad surprise.
        if (sub.metadata?.type === 'agency_activation') continue;

        const item = sub.items?.data?.[0];
        candidates.push({
          id,
          status: sub.status,
          amountCents: item?.price?.unit_amount ?? 0,
          periodEnd: (sub as any).current_period_end ?? item?.current_period_end ?? 0,
          created: sub.created,
          latestInvoice:
            typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id ?? null,
        });
      } catch {
        // Not known to Stripe — a mirror row with no counterpart bills nobody.
      }
    }

    if (candidates.length <= 1) {
      console.log(
        `\nℹ️  ${shop.shop_name} (${shop.shop_id}): ${shop.live_rows} mirror rows but ` +
          `${candidates.length} live at Stripe — stale mirror, nothing to cancel.`
      );
      continue;
    }

    const survivor = chooseSubscriptionToKeep(candidates)!;
    const doomed = candidates.filter((c) => c.id !== survivor.id);

    console.log(`\n${shop.shop_name} (${shop.shop_id}) — billed ${candidates.length}×`);
    console.log(`   KEEP    ${survivor.id}  ${money(survivor.amountCents)}/mo  through ${day(survivor.periodEnd)}`);

    for (const sub of doomed) {
      monthlySaved += sub.amountCents;
      const invoice = sub.latestInvoice ? `  last invoice ${sub.latestInvoice}` : '';
      if (!APPLY) {
        console.log(`   CANCEL  ${sub.id}  ${money(sub.amountCents)}/mo  through ${day(sub.periodEnd)}${invoice}`);
        continue;
      }

      try {
        await stripe.subscriptions.cancel(sub.id);
        // Written locally as well as waiting for the webhook: the cancellation is a fact we just
        // established, and a mirror that stays stale would report this shop as double-billed until
        // the webhook happens to arrive — or forever, on an environment with no webhook wired up.
        await pool.query(
          `UPDATE stripe_subscriptions SET status = 'canceled', updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        cancelled++;
        console.log(`   ✅ CANCELLED ${sub.id}  ${money(sub.amountCents)}/mo${invoice}`);
      } catch (e) {
        console.log(`   ❌ FAILED ${sub.id}: ${e instanceof Error ? e.message : 'unknown error'}`);
        process.exitCode = 1;
      }
    }
  }

  console.log('');
  if (!APPLY) {
    console.log(
      `Dry run only. ${money(monthlySaved)}/month of duplicate billing would stop.\n` +
        'Re-run with --apply to cancel. Refunds for periods already charged are a separate\n' +
        'decision — the last invoice of each subscription above is printed for that.'
    );
  } else {
    console.log(`Cancelled ${cancelled} subscription(s), ${money(monthlySaved)}/month of duplicate billing stopped.`);
    console.log('Run `npm run db:check-subs` to confirm the state reconciles.');
  }
}

main()
  .catch((e) => {
    console.error('Dedupe failed to run:', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
