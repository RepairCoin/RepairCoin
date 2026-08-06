import { liveSubscriptionFirst } from './sqlFragments';

/**
 * The two ways a shop's subscription state can be wrong, both silent by construction.
 *
 * Neither errors. A shop with two live subscriptions is billed twice and nothing says so; a shop
 * whose Stripe cover lapsed months ago keeps full access because our own row still reads active.
 * Both need an assertion rather than a dashboard nobody opens — see check-subscription-integrity.
 */

/**
 * Shops billing more than once. Stripe is the authority on whether a subscription is live, but the
 * mirror is enough to FIND the suspects; the script confirms each against Stripe before reporting,
 * because a stale mirror row would otherwise read as double billing.
 */
export const DUPLICATE_LIVE_SUBS_SQL = `
  SELECT s.shop_id,
         sh.name AS shop_name,
         count(*)::int AS live_rows,
         array_agg(s.stripe_subscription_id ORDER BY s.current_period_end DESC) AS subscription_ids
  FROM stripe_subscriptions s
  JOIN shops sh ON sh.shop_id = s.shop_id
  WHERE s.status IN ('active', 'trialing', 'past_due')
    AND s.current_period_end > NOW()
  GROUP BY s.shop_id, sh.name
  HAVING count(*) > 1
  ORDER BY count(*) DESC, sh.name
`;

/**
 * Shops we treat as paying that have no live Stripe cover behind them.
 *
 * Nothing is excluded. An earlier version skipped `commitment_qualified` on the assumption that it
 * meant a plan billed outside Stripe — it did not. That status was written by a database trigger
 * left over from the removed commitment system (migration 267), and keying off it hid a shop that
 * had enrolled on Business, never activated, never paid a cent, and held full access for three
 * weeks. An exclusion that rests on a label rather than on evidence of payment will hide exactly
 * the case worth finding.
 */
export const ACTIVE_WITHOUT_COVER_SQL = `
  WITH live AS (
    SELECT DISTINCT ON (shop_id) shop_id, status, current_period_end
    FROM stripe_subscriptions
    ORDER BY shop_id, ${liveSubscriptionFirst()}
  )
  SELECT sh.shop_id,
         sh.name AS shop_name,
         sh.operational_status,
         s.subscription_type,
         s.next_payment_date,
         -- Whether the shop ever paid separates "cover lapsed" from "never had any", and the two
         -- need different conversations.
         s.payments_made,
         s.total_paid,
         l.status AS stripe_status,
         l.current_period_end AS stripe_period_end
  FROM shop_subscriptions s
  JOIN shops sh ON sh.shop_id = s.shop_id
  LEFT JOIN live l ON l.shop_id = s.shop_id
  WHERE s.status = 'active'
    AND s.is_active = true
    AND (
      l.shop_id IS NULL
      OR l.current_period_end < NOW()
      OR l.status NOT IN ('active', 'trialing', 'past_due')
    )
  ORDER BY sh.name
`;
