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
 * Commitment plans are excluded, not overlooked: they are billed outside Stripe, so having no
 * Stripe row is their normal state rather than a gap.
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
         l.status AS stripe_status,
         l.current_period_end AS stripe_period_end
  FROM shop_subscriptions s
  JOIN shops sh ON sh.shop_id = s.shop_id
  LEFT JOIN live l ON l.shop_id = s.shop_id
  WHERE s.status = 'active'
    AND s.is_active = true
    AND sh.operational_status IS DISTINCT FROM 'commitment_qualified'
    AND (
      l.shop_id IS NULL
      OR l.current_period_end < NOW()
      OR l.status NOT IN ('active', 'trialing', 'past_due')
    )
  ORDER BY sh.name
`;
