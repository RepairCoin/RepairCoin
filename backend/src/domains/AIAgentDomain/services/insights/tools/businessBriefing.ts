// backend/src/domains/AIAgentDomain/services/insights/tools/businessBriefing.ts
//
// Tool: business_briefing (FixFlow AI Operator — Phase 1, "Morning Briefing")
//
// ONE composed read that returns all the headline numbers a shop owner wants
// when they ask "how are we doing?" — so the assistant answers in a single turn
// (Information → Recommendation → Action) instead of chaining five separate
// metric tools. Composes the same SQL the dedicated tools use:
//   - revenue trend     (service_orders, last 7d vs prior 7d)
//   - top service       (service_orders × shop_services, last 30d by revenue)
//   - lapsed customers  (no order in 90d) + their COMBINED spend
//   - low stock         (inventory_items at/under threshold)
//   - upcoming demand    (bookings per day over the next 7 days; quietest day)
//
// Each metric is computed defensively (safe()): one failing query degrades to
// `{ error }` for that metric rather than failing the whole briefing. Shop-
// scoped via ctx.shopId (never from Claude's args). Read-only.
//
// NOTE (v1): the upcoming-demand signal is booking VOLUME per day (+ the
// quietest day), not true capacity-% utilization. Real "% booked" needs the
// shop_availability + shop_time_slot_config slot math — a documented fast-follow
// (see fixflow-ai-operator-implementation-1-4.md, Phase 1 risks).

import { Pool } from "pg";
import { BusinessInsightsTool, ToolContext, ToolResult } from "../types";

const NAME = "business_briefing";

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

export const businessBriefing: BusinessInsightsTool = {
  name: NAME,
  description:
    "Get a complete one-shot BUSINESS BRIEFING for this shop — revenue trend, " +
    "top service, lapsed customers + their combined value, low-stock items, and " +
    "upcoming-booking demand — all in a single call. Call this when the owner " +
    "asks a BROAD status question: 'how are we doing?', 'give me a rundown', " +
    "'morning briefing', \"how's the business?\", 'what's going on?'. Then " +
    "summarize the numbers and recommend ONE next step. Do NOT also call the " +
    "individual metric tools for the same question — this already has them.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { pool, shopId } = ctx;
    const [revenue, topService, lapsed, lowStock, bookings] = await Promise.all([
      safe(() => revenueTrend(pool, shopId)),
      safe(() => topServiceByRevenue(pool, shopId)),
      safe(() => lapsedValue(pool, shopId)),
      safe(() => lowStockSummary(pool, shopId)),
      safe(() => upcomingDemand(pool, shopId)),
    ]);
    return { data: { revenue, topService, lapsed, lowStock, bookings } };
  },
};

/** Run a metric query, degrading a failure to `{ error }` so one broken metric
 *  doesn't sink the whole briefing. */
async function safe<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function revenueTrend(pool: Pool, shopId: string) {
  const r = await pool.query<{ cur: string; prev: string }>(
    `SELECT
       COALESCE(SUM(total_amount) FILTER (
         WHERE created_at >= now() - interval '7 days'), 0)::float8::text AS cur,
       COALESCE(SUM(total_amount) FILTER (
         WHERE created_at >= now() - interval '14 days'
           AND created_at <  now() - interval '7 days'), 0)::float8::text AS prev
     FROM service_orders
     WHERE shop_id = $1 AND status IN ('paid', 'completed')`,
    [shopId]
  );
  const cur = Number(r.rows[0]?.cur ?? 0);
  const prev = Number(r.rows[0]?.prev ?? 0);
  const deltaPct = prev === 0 ? null : ((cur - prev) / prev) * 100;
  return {
    window: "last 7 days vs prior 7 days",
    currentUsd: round2(cur),
    priorUsd: round2(prev),
    deltaPct: deltaPct === null ? null : round1(deltaPct),
  };
}

async function topServiceByRevenue(pool: Pool, shopId: string) {
  const r = await pool.query<{ service_name: string | null; revenue: string; orders: number }>(
    `SELECT s.service_name,
            COALESCE(SUM(o.total_amount), 0)::float8::text AS revenue,
            COUNT(*)::int AS orders
     FROM service_orders o
     LEFT JOIN shop_services s ON s.service_id = o.service_id
     WHERE o.shop_id = $1 AND o.status IN ('paid', 'completed')
       AND o.created_at >= now() - interval '30 days'
     GROUP BY s.service_name
     ORDER BY SUM(o.total_amount) DESC NULLS LAST
     LIMIT 1`,
    [shopId]
  );
  const row = r.rows[0];
  if (!row) return { window: "last 30 days", name: null };
  return {
    window: "last 30 days",
    name: (row.service_name ?? "").trim() || "(unnamed service)",
    revenueUsd: round2(Number(row.revenue)),
    orders: row.orders,
  };
}

async function lapsedValue(pool: Pool, shopId: string) {
  // Count only lapsed customers a win-back campaign can actually TARGET:
  // those with an active customer record (INNER JOIN customers, is_active,
  // not suspended). This mirrors CustomerRepository.findLapsedBookers exactly,
  // so the briefing's "lapsed customers" number matches the audience the
  // owner gets when they act on the recommendation. Guest / orphan orders
  // (no customer record — unreachable, no email) are excluded: counting them
  // here would promise a win-back the campaign can't deliver.
  const r = await pool.query<{ n: number; total_spend: string }>(
    `WITH per_customer AS (
       SELECT o.customer_address,
              MAX(o.created_at) AS last_at,
              COALESCE(SUM(o.total_amount) FILTER (
                WHERE o.status IN ('paid', 'completed')), 0)::float8 AS spend
       FROM service_orders o
       JOIN customers c ON LOWER(c.address) = LOWER(o.customer_address)
       WHERE o.shop_id = $1 AND o.customer_address IS NOT NULL
         AND c.is_active = true AND c.suspended_at IS NULL
       GROUP BY o.customer_address
     )
     SELECT COUNT(*)::int AS n,
            COALESCE(SUM(spend), 0)::float8::text AS total_spend
     FROM per_customer
     WHERE last_at <= now() - interval '90 days'`,
    [shopId]
  );
  return {
    thresholdDays: 90,
    count: r.rows[0]?.n ?? 0,
    combinedSpendUsd: round2(Number(r.rows[0]?.total_spend ?? 0)),
  };
}

async function lowStockSummary(pool: Pool, shopId: string) {
  const where = `shop_id = $1 AND deleted_at IS NULL AND status <> 'discontinued'
                 AND stock_quantity <= low_stock_threshold`;
  const top = await pool.query<{ name: string; qty: number; threshold: number }>(
    `SELECT name, stock_quantity::int AS qty, low_stock_threshold::int AS threshold
     FROM inventory_items
     WHERE ${where}
     ORDER BY (stock_quantity::float / NULLIF(low_stock_threshold, 0)) ASC NULLS FIRST, name ASC
     LIMIT 3`,
    [shopId]
  );
  const c = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM inventory_items WHERE ${where}`,
    [shopId]
  );
  return {
    count: c.rows[0]?.n ?? 0,
    top: top.rows.map((x) => ({ name: x.name, inStock: x.qty, threshold: x.threshold })),
  };
}

async function upcomingDemand(pool: Pool, shopId: string) {
  const r = await pool.query<{ d: string; n: number }>(
    `SELECT booking_date::date::text AS d, COUNT(*)::int AS n
     FROM service_orders
     WHERE shop_id = $1
       AND booking_date >= current_date
       AND booking_date < current_date + interval '7 days'
       AND status NOT IN ('cancelled', 'expired', 'no_show')
     GROUP BY booking_date::date
     ORDER BY booking_date::date`,
    [shopId]
  );
  const byDay = r.rows.map((x) => ({ date: x.d, bookings: x.n }));
  const total = byDay.reduce((s, d) => s + d.bookings, 0);
  const quietestDay = byDay.length
    ? byDay.reduce((a, b) => (b.bookings < a.bookings ? b : a))
    : null;
  const busiestDay = byDay.length
    ? byDay.reduce((a, b) => (b.bookings > a.bookings ? b : a))
    : null;
  return {
    window: "next 7 days",
    signal: "booking volume per day (not capacity %)",
    totalBookings: total,
    byDay,
    quietestDay,
    busiestDay,
  };
}
