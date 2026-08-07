// backend/src/utils/ledgerCompleteness.ts
/**
 * Which paid bookings are missing from the fiat `payments` ledger (POS S9b).
 *
 * Since S9a the shop dashboard reads revenue from `payments`, so a booking whose payment never
 * reached the ledger contributes nothing to the figure the shop is shown. This is the one place
 * that defines the gap, shared by the backfill that closes it and the check that proves it stays
 * closed — two definitions would drift and the check would bless a backfill that missed rows.
 */

import { revenueRecognized } from './sqlFragments';

/**
 * An order is covered if a ledger row points at it, either by `order_id` or by the PaymentIntent.
 *
 * The second half is not redundant: the webhook reconciler writes `order_id` from the charge's
 * metadata, and bookings taken before that metadata was set on `payment_intent_data` produced rows
 * with a null `order_id`. Matching on the intent as well stops those from being counted as gaps and
 * backfilled a second time.
 */
export const LEDGER_COVERED_JOIN = `
  LEFT JOIN payments p
    ON p.order_id = o.order_id
    OR (o.stripe_payment_intent_id LIKE 'pi_%' AND p.stripe_payment_intent_id = o.stripe_payment_intent_id)`;

/** Paid bookings with no ledger row, as a WHERE clause over `service_orders o` + LEDGER_COVERED_JOIN. */
export const LEDGER_GAP_WHERE = `${revenueRecognized('o')} AND p.id IS NULL`;

/**
 * How a gap can be closed, decided by what reference the order carries.
 *
 * `session` is recoverable: the id is a Checkout Session, which resolves to its PaymentIntent
 * through the Stripe API. `intent` needs nothing but a re-run. `none` was settled outside Stripe
 * and the row has to be written from the order itself — there is no external record to consult.
 */
export type LedgerGapClass = 'intent' | 'session' | 'none';

export const LEDGER_GAP_CLASS_SQL = `
  CASE
    WHEN o.stripe_payment_intent_id LIKE 'pi_%' THEN 'intent'
    WHEN o.stripe_payment_intent_id LIKE 'cs_%' OR o.stripe_session_id LIKE 'cs_%' THEN 'session'
    ELSE 'none'
  END`;

export const LEDGER_GAP_SUMMARY_SQL = `
  SELECT ${LEDGER_GAP_CLASS_SQL} AS gap_class,
         count(*)::int AS orders,
         COALESCE(sum(COALESCE(o.final_amount_usd, o.total_amount, 0)), 0)::numeric(12,2) AS usd
  FROM service_orders o
  ${LEDGER_COVERED_JOIN}
  WHERE ${LEDGER_GAP_WHERE}
  GROUP BY 1
  ORDER BY 1`;

export const LEDGER_GAP_ROWS_SQL = `
  SELECT o.order_id,
         o.shop_id,
         o.customer_address,
         o.status,
         o.payment_status,
         COALESCE(o.final_amount_usd, o.total_amount, 0) AS amount_usd,
         o.stripe_payment_intent_id,
         o.stripe_session_id,
         o.created_at,
         ${LEDGER_GAP_CLASS_SQL} AS gap_class,
         s.stripe_connect_account_id
  FROM service_orders o
  JOIN shops s ON s.shop_id = o.shop_id
  ${LEDGER_COVERED_JOIN}
  WHERE ${LEDGER_GAP_WHERE}
  ORDER BY o.created_at DESC`;
