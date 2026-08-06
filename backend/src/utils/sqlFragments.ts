// backend/src/utils/sqlFragments.ts
/**
 * Reusable SQL fragments for common query patterns
 * This ensures consistency across all service-related queries
 */

/**
 * Which orders count as money the shop actually took.
 *
 * `status` tracks FULFILMENT and `payment_status` tracks MONEY, and they disagree: an order can
 * be marked completed while its payment is still unpaid or pending. Reporting on `status` alone
 * therefore counts work that was done but never paid for as revenue.
 *
 * Both halves are required. `payment_status` alone would pull in cancelled and expired orders
 * that were paid and may since have been refunded — a separate question, deliberately not
 * answered here.
 *
 * Money only. Order counts, popularity and calendar sync legitimately include unpaid orders —
 * an unpaid booking still happened.
 *
 * @param alias table alias used in the query, e.g. 'o' or 'so'. Omit for an unaliased table.
 */
export const revenueRecognized = (alias = ''): string => {
  const p = alias ? `${alias}.` : '';
  return `${p}status IN ('paid', 'completed') AND ${p}payment_status = 'paid'`;
};

/**
 * Which of a shop's `stripe_subscriptions` rows speaks for the shop.
 *
 * A shop accumulates rows — resubscribes, plan changes, superseded checkout sessions — and they are
 * NOT in chronological order of relevance: a row created seconds LATER can be the one that got
 * cancelled. `ORDER BY created_at DESC LIMIT 1` therefore reads a dead subscription as the shop's
 * current one, and every consumer inherits its expired period end. That is how a shop paid up to
 * 21 August was reported expired since 21 July, in the admin list and on its own dashboard, while
 * `shop_subscriptions` said active the whole time.
 *
 * A live row always beats a cancelled one; among equals the furthest-reaching billing period wins,
 * because that is the cover actually paid for. `created_at` only breaks the remaining ties.
 *
 * Use as the ORDER BY tail — after `shop_id` in a `DISTINCT ON (shop_id)`, or on its own with
 * `LIMIT 1` for a single shop. The TypeScript twin is `pickLiveSubscription` in
 * middleware/subscriptionGuard, for the places that hold the rows in memory.
 *
 * @param alias table alias used in the query. Omit for an unaliased table.
 */
export const liveSubscriptionFirst = (alias = ''): string => {
  const p = alias ? `${alias}.` : '';
  return `(${p}status IN ('active', 'trialing', 'past_due')) DESC,
          ${p}current_period_end DESC NULLS LAST,
          ${p}created_at DESC`;
};

/**
 * Which rows of the fiat `payments` ledger count as revenue (POS S9c-1).
 *
 * `refunded` is included, not excluded: a fully refunded payment contributes gross - refunded = 0
 * through {@link ledgerRevenueCents}, so excluding it would be the same answer written twice, and
 * `partially_refunded` genuinely must stay. What this keeps out is money that never arrived —
 * `failed`, `processing`, `requires_payment`.
 *
 * @param alias table alias used in the query. Omit for an unaliased table.
 */
export const ledgerRecognized = (alias = 'p'): string => {
  const p = alias ? `${alias}.` : '';
  return `${p}status IN ('succeeded', 'partially_refunded', 'refunded')`;
};

/**
 * Which ledger sources are money a CUSTOMER paid a SHOP — the only kind that is shop revenue.
 *
 * The ledger is deliberately wider than that. `rcn_purchase` is a shop buying tokens from the
 * platform, which is platform revenue and would double-count the shop's own spending as its
 * earnings. `deposit` is a customer no-show deposit, which is `held` until it is refunded or
 * forfeited — a liability, not something earned. Both live in `payments` and both must stay out of
 * a revenue figure.
 *
 * Always pair with {@link ledgerRecognized}; this answers "whose money", that answers "did it
 * arrive".
 */
export const ledgerCustomerRevenue = (alias = 'p'): string => {
  const p = alias ? `${alias}.` : '';
  return `${p}source IN ('booking', 'terminal', 'invoice', 'link')`;
};

/**
 * What a ledger row contributed to revenue, in CENTS.
 *
 * Net of tax and net of refunds. Sales tax sits inside `gross_cents` but was collected for the
 * state and was never the shop's money, and a counter sale would otherwise read higher than an
 * identical booking purely because of the local rate. Bookings carry `tax_cents = 0`, so the same
 * expression is correct for both channels — which is the point of moving revenue here.
 *
 * Divide by 100 at the edge; the ledger is integer cents throughout and the legacy
 * `service_orders` columns are DECIMAL dollars, so mixing them without converting is a real risk.
 */
export const ledgerRevenueCents = (alias = 'p'): string => {
  const p = alias ? `${alias}.` : '';
  return `(${p}gross_cents - ${p}tax_cents - ${p}refunded_cents)`;
};

/**
 * Every line of trade a shop did, from both channels, at the grain a per-service or per-category
 * report needs (POS S9c-2).
 *
 * The fiat ledger cannot answer these: `payments` is one row per money movement with no line items,
 * so a $340 counter sale is a single row that does not know it was a screen repair plus two
 * batteries. The detail only exists on the lines, so these reports read the lines.
 *
 * **The booking half takes its amount from the ledger and uses the order only to say which service
 * it was for.** The obvious alternative — filter `service_orders` by {@link revenueRecognized} and
 * use `final_amount_usd` — disagrees with the shop total badly, because the ledger counts money that
 * arrived regardless of what the booking's status later became, while `revenueRecognized` drops
 * paid-then-cancelled orders whose money the shop kept. On staging that was the difference between
 * $1,207.76 and $566.98 for one shop: categories would have summed to 71% of the revenue shown
 * directly above them on the same screen.
 *
 * The counter half has to come from the lines, because that is the only place the detail exists, so
 * a residual against the ledger total remains. Structurally it is whatever RCN and gift cards
 * covered plus counter refunds; on staging it is mostly counter sales completed before S6a wired
 * the POS into the ledger at all, which have lines but no ledger row and never will. That residual
 * is bounded and explainable. The 30% one was neither.
 *
 * Counter lines are net of tax and of discounts, **gross of refunds**: a refund is recorded against
 * the payment, not against a line, so there is no honest way to attribute one to a service without
 * inventing a split. Voided and still-open sales are excluded; refunded ones are not, for that
 * reason.
 *
 * Booking payments that never linked to an order cannot be attributed to a service and are absent
 * here — one row on staging, from before the charge metadata carried an orderId.
 *
 * Columns: `shop_id`, `location_id`, `service_id` (null on non-service counter lines), `bucket`
 * (null when `service_id` is set), `revenue_cents`, `ref` (the order or sale the line belongs to,
 * for distinct counts), `channel`, `occurred_at`.
 *
 * `occurred_at` is when the money landed — capture time for a booking, completion time for a
 * counter sale — so a windowed report ("last 30 days") means the same thing on both channels and
 * matches how the ledger-based totals bucket.
 */
export const SERVICE_LINE_REVENUE = `
  SELECT
    o.shop_id,
    o.location_id,
    o.service_id,
    NULL::varchar        AS bucket,
    (p.gross_cents - p.tax_cents - p.refunded_cents)::int AS revenue_cents,
    o.order_id::text     AS ref,
    'booking'::varchar   AS channel,
    COALESCE(p.captured_at, p.created_at) AS occurred_at
  FROM payments p
  JOIN service_orders o ON o.order_id = p.order_id
  WHERE ${ledgerRecognized('p')}
    AND p.source IN ('booking', 'invoice', 'link')

  UNION ALL

  SELECT
    ps.shop_id,
    ps.location_id,
    i.service_id,
    CASE i.kind WHEN 'product' THEN 'Products' WHEN 'custom' THEN 'Other' END::varchar AS bucket,
    (i.total_cents - i.tax_cents)::int AS revenue_cents,
    ps.id::text          AS ref,
    'pos'::varchar       AS channel,
    COALESCE(ps.completed_at, ps.created_at) AS occurred_at
  FROM pos_sale_items i
  JOIN pos_sales ps ON ps.id = i.sale_id
  WHERE ps.status IN ('completed', 'partially_refunded', 'refunded')
`;

/**
 * What each customer has spent at one shop, from the fiat ledger (POS S9c-3).
 *
 * Derived from `service_orders` this missed counter sales entirely, so a regular who buys at the
 * till every week showed as having spent nothing. The ledger already carries `customer_address` on
 * both channels, so one source answers it for both.
 *
 * **Walk-ins are not attributable and never will be.** A counter sale does not require a customer —
 * that is deliberate, it is how a till works — so the sum of customer spend is always less than the
 * shop's revenue. On staging that is 10 of 12 completed sales. Do not treat the difference as a bug.
 *
 * Takes the shop id as `$1`. Produces `customer_address` (lower-cased for joining against
 * `customers.address`) and `total_spent` in DOLLARS, matching the legacy column it replaces.
 */
export const CUSTOMER_SPEND_FROM_LEDGER = `
  SELECT
    LOWER(customer_address) AS customer_address,
    (SUM(${ledgerRevenueCents('')}) / 100.0) AS total_spent
  FROM payments
  WHERE shop_id = $1
    AND customer_address IS NOT NULL
    AND ${ledgerRecognized('')}
    AND ${ledgerCustomerRevenue('')}
  GROUP BY LOWER(customer_address)
`;

/**
 * Subquery to fetch all affiliate groups linked to a service
 * Returns a JSON array of group objects or NULL if no groups linked
 *
 * Usage: Include this in your SELECT statement as a column
 * Example: SELECT s.*, ${SERVICE_GROUPS_SUBQUERY} FROM shop_services s
 */
export const SERVICE_GROUPS_SUBQUERY = `
  (
    SELECT json_agg(json_build_object(
      'groupId', sga.group_id,
      'groupName', asg.group_name,
      'customTokenSymbol', asg.custom_token_symbol,
      'customTokenName', asg.custom_token_name,
      'icon', asg.icon,
      'tokenRewardPercentage', sga.token_reward_percentage,
      'bonusMultiplier', sga.bonus_multiplier,
      'estimatedTokens', s.price_usd * (sga.token_reward_percentage / 100) * sga.bonus_multiplier,
      'available', COALESCE(alloc.allocated_rcn - alloc.used_rcn, 0) >= (s.price_usd * (sga.token_reward_percentage / 100) * sga.bonus_multiplier / 2)
    ))
    FROM service_group_availability sga
    JOIN affiliate_shop_groups asg ON sga.group_id = asg.group_id
    LEFT JOIN shop_group_rcn_allocations alloc ON alloc.shop_id = s.shop_id AND alloc.group_id = sga.group_id
    WHERE sga.service_id = s.service_id AND sga.active = true
  ) as groups
`;

/**
 * Common service fields selection
 * Use this to ensure consistent field selection across all service queries
 */
export const SERVICE_BASE_FIELDS = `
  s.service_id,
  s.shop_id,
  s.service_name,
  s.description,
  s.price_usd,
  s.duration_minutes,
  s.category,
  s.image_url,
  s.tags,
  s.active,
  s.average_rating,
  s.review_count,
  s.created_at,
  s.updated_at
`;

/**
 * Common shop fields selection for service queries
 * Use this when joining shop_services with shops table
 */
export const SHOP_INFO_FIELDS = `
  sh.shop_id,
  sh.name as company_name,
  sh.name as shop_name,
  sh.address as shop_address,
  sh.location_city as shop_city,
  sh.country as shop_country,
  sh.phone as shop_phone,
  sh.email as shop_email,
  sh.verified as shop_is_verified,
  sh.location_lat,
  sh.location_lng,
  sh.location_city,
  sh.location_state,
  sh.location_zip_code
`;

/**
 * Full service query fields (service + shop + groups)
 * This is the most complete selection for customer-facing service queries
 */
export const FULL_SERVICE_FIELDS = `
  ${SERVICE_BASE_FIELDS},
  ${SHOP_INFO_FIELDS},
  ${SERVICE_GROUPS_SUBQUERY}
`;

/**
 * Shop location subquery for distance calculations
 * Returns shop location as a JSON object
 */
export const SHOP_LOCATION_SUBQUERY = `
  json_build_object(
    'lat', sh.location_lat,
    'lng', sh.location_lng,
    'city', sh.location_city,
    'state', sh.location_state,
    'zipCode', sh.location_zip_code
  ) as shop_location
`;
