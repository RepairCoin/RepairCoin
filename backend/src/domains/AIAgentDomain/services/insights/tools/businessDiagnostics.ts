// backend/src/domains/AIAgentDomain/services/insights/tools/businessDiagnostics.ts
//
// Tool: business_diagnostics (FixFlow AI Operator — Phase 4, "What am I doing wrong?")
//
// Composes the OPERATIONAL-HEALTH metrics that flag what's slipping, each this
// 30 days vs the prior 30 days, with a `regressed` flag on the ones that got
// meaningfully worse (>15% the wrong way, with a minimum sample to avoid noise):
//   - response_time     — avg minutes for the shop to reply to a customer
//                         message (messages × conversations, customer→next-shop)
//   - review_conversion — reviews left ÷ completed orders
//   - booking_health    — no-show + cancellation rate
//
// The assistant reports only the metrics that regressed, then hypothesizes 2-3
// likely causes (grounded in the deltas — never invented). Each metric is
// safe()-wrapped: one failing query degrades to `{ error }`, not a dead tool.
//
// SCOPE: business-level only. Per-employee/technician productivity ("technicians
// 22% slower") needs employee accounts + tracking (Phase 5, not built) — the
// description tells the model to say so if asked.

import { Pool } from "pg";
import { BusinessInsightsTool, ToolContext, ToolResult } from "../types";

const NAME = "business_diagnostics";
const MIN_SAMPLE = 3; // need ≥3 data points in BOTH windows to call a trend
const REGRESS_FACTOR = 1.15; // >15% the wrong way = "regressed"

const round1 = (n: number) => Math.round(n * 10) / 10;

export const businessDiagnostics: BusinessInsightsTool = {
  name: NAME,
  description:
    "Diagnose what might be SLIPPING in the business — message response time, " +
    "review conversion, and booking health (no-shows + cancellations), each this " +
    "30 days vs the prior 30 days, with a flag on the ones that got worse. Call " +
    "this when the owner asks 'what am I doing wrong?', \"what's slipping?\", " +
    "'where are we losing money?', or 'why is business down?'. Report ONLY the " +
    "metrics that regressed, then suggest 2-3 LIKELY causes as hypotheses grounded " +
    "in the numbers (never invented). This is BUSINESS-level only — it does NOT " +
    "cover per-employee/technician performance (that needs employee accounts, " +
    "which don't exist yet); say so if the owner asks about a specific staffer.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { pool, shopId } = ctx;
    const [responseTime, reviewConversion, bookingHealth] = await Promise.all([
      safe(() => responseTimeMetric(pool, shopId)),
      safe(() => reviewConversionMetric(pool, shopId)),
      safe(() => bookingHealthMetric(pool, shopId)),
    ]);
    const metrics = { responseTime, reviewConversion, bookingHealth };
    const regressedCount = Object.values(metrics).filter(
      (m) => m && typeof m === "object" && (m as { regressed?: boolean }).regressed
    ).length;
    return { data: { window: "last 30 days vs prior 30 days", regressedCount, ...metrics } };
  },
};

async function safe<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function responseTimeMetric(pool: Pool, shopId: string) {
  const r = await pool.query<{ cur: string | null; cur_n: number; prev: string | null; prev_n: number }>(
    `WITH paired AS (
       SELECT m.created_at AS cust_at, m.sender_type,
              LEAD(m.created_at) OVER (PARTITION BY m.conversation_id ORDER BY m.created_at) AS next_at,
              LEAD(m.sender_type) OVER (PARTITION BY m.conversation_id ORDER BY m.created_at) AS next_type
       FROM messages m
       JOIN conversations c ON c.conversation_id = m.conversation_id
       WHERE c.shop_id = $1
     )
     SELECT
       (AVG(EXTRACT(EPOCH FROM (next_at - cust_at)) / 60.0)
         FILTER (WHERE cust_at >= now() - interval '30 days'))::float8::text AS cur,
       COUNT(*) FILTER (WHERE cust_at >= now() - interval '30 days')::int AS cur_n,
       (AVG(EXTRACT(EPOCH FROM (next_at - cust_at)) / 60.0)
         FILTER (WHERE cust_at >= now() - interval '60 days' AND cust_at < now() - interval '30 days'))::float8::text AS prev,
       COUNT(*) FILTER (WHERE cust_at >= now() - interval '60 days' AND cust_at < now() - interval '30 days')::int AS prev_n
     FROM paired
     WHERE sender_type = 'customer' AND next_type = 'shop'`,
    [shopId]
  );
  const row = r.rows[0];
  const curN = row?.cur_n ?? 0;
  const prevN = row?.prev_n ?? 0;
  if (curN < MIN_SAMPLE || prevN < MIN_SAMPLE) {
    return { metric: "response_time", insufficientData: true, currentSampleSize: curN, priorSampleSize: prevN };
  }
  const cur = Number(row.cur);
  const prev = Number(row.prev);
  return {
    metric: "response_time",
    unit: "avg minutes to first reply",
    higherIsWorse: true,
    currentMinutes: round1(cur),
    priorMinutes: round1(prev),
    deltaPct: prev === 0 ? null : round1(((cur - prev) / prev) * 100),
    // Only a problem if it slowed AND replies are now actually slow (≥15 min) —
    // a jump from 0.1→0.3 min is statistical noise, not a regression.
    regressed: cur > prev * REGRESS_FACTOR && cur >= 15,
    sampleSizes: { current: curN, prior: prevN },
  };
}

async function reviewConversionMetric(pool: Pool, shopId: string) {
  const r = await pool.query<{ comp_cur: number; rev_cur: number; comp_prev: number; rev_prev: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM service_orders
          WHERE shop_id = $1 AND status = 'completed'
            AND COALESCE(completed_at, created_at) >= now() - interval '30 days') AS comp_cur,
       (SELECT COUNT(*)::int FROM service_reviews
          WHERE shop_id = $1 AND created_at >= now() - interval '30 days') AS rev_cur,
       (SELECT COUNT(*)::int FROM service_orders
          WHERE shop_id = $1 AND status = 'completed'
            AND COALESCE(completed_at, created_at) >= now() - interval '60 days'
            AND COALESCE(completed_at, created_at) < now() - interval '30 days') AS comp_prev,
       (SELECT COUNT(*)::int FROM service_reviews
          WHERE shop_id = $1 AND created_at >= now() - interval '60 days'
            AND created_at < now() - interval '30 days') AS rev_prev`,
    [shopId]
  );
  const { comp_cur, rev_cur, comp_prev, rev_prev } = r.rows[0];
  if (comp_cur < MIN_SAMPLE || comp_prev < MIN_SAMPLE) {
    return { metric: "review_conversion", insufficientData: true, completedCurrent: comp_cur, completedPrior: comp_prev };
  }
  const cur = (rev_cur / comp_cur) * 100;
  const prev = (rev_prev / comp_prev) * 100;
  return {
    metric: "review_conversion",
    unit: "% of completed orders that got a review",
    higherIsWorse: false,
    currentPct: round1(cur),
    priorPct: round1(prev),
    deltaPct: prev === 0 ? null : round1(((cur - prev) / prev) * 100),
    // Only flag a drop if the prior rate was meaningful (≥5%) — avoids noise.
    regressed: cur < prev / REGRESS_FACTOR && prev >= 5,
    counts: { reviewsCurrent: rev_cur, completedCurrent: comp_cur, reviewsPrior: rev_prev, completedPrior: comp_prev },
  };
}

async function bookingHealthMetric(pool: Pool, shopId: string) {
  const r = await pool.query<{
    tot_cur: number; ns_cur: number; cx_cur: number;
    tot_prev: number; ns_prev: number; cx_prev: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS tot_cur,
       COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days' AND (no_show OR status = 'no_show'))::int AS ns_cur,
       COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status = 'cancelled')::int AS cx_cur,
       COUNT(*) FILTER (WHERE created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days')::int AS tot_prev,
       COUNT(*) FILTER (WHERE created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days' AND (no_show OR status = 'no_show'))::int AS ns_prev,
       COUNT(*) FILTER (WHERE created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days' AND status = 'cancelled')::int AS cx_prev
     FROM service_orders WHERE shop_id = $1`,
    [shopId]
  );
  const x = r.rows[0];
  if (x.tot_cur < MIN_SAMPLE || x.tot_prev < MIN_SAMPLE) {
    return { metric: "booking_health", insufficientData: true, ordersCurrent: x.tot_cur, ordersPrior: x.tot_prev };
  }
  const cur = ((x.ns_cur + x.cx_cur) / x.tot_cur) * 100;
  const prev = ((x.ns_prev + x.cx_prev) / x.tot_prev) * 100;
  return {
    metric: "booking_health",
    unit: "% of orders that no-showed or cancelled",
    higherIsWorse: true,
    currentProblemRatePct: round1(cur),
    priorProblemRatePct: round1(prev),
    deltaPct: prev === 0 ? null : round1(((cur - prev) / prev) * 100),
    // Only a problem if it rose AND the problem rate is now actually high (≥10%).
    regressed: cur > prev * REGRESS_FACTOR && cur >= 10,
    breakdown: {
      current: { total: x.tot_cur, noShows: x.ns_cur, cancellations: x.cx_cur },
      prior: { total: x.tot_prev, noShows: x.ns_prev, cancellations: x.cx_prev },
    },
  };
}
