// backend/src/domains/AIAgentDomain/services/MetricsAggregator.ts
//
// Aggregates the AI Sales Agent Impact Metrics for one shop over a time
// window. See scope-doc Section 4 for the v1 metric contract:
//   docs/tasks/strategy/ai-sales-agent/ai-sales-agent-impact-metrics.md
//
// One method, three small queries: AI message stats, booking + revenue,
// customers recovered. A single combined query would cross tables with
// different cardinality (an AI message JOIN orders multiplies rows) — three
// targeted queries each leaning on the existing indexes is simpler and
// performs better than fighting that.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { MIN_SAMPLE_N } from "../constants";

/**
 * Window for the aggregate. `null` = all-time; otherwise the lower bound
 * (inclusive) for `created_at` filtering. The caller (controller) maps the
 * range pill (7d / 30d / 90d / all) to a Date here.
 */
export type MetricsWindow = Date | null;

export interface ImpactMetrics {
  /** Number of distinct conversations where the AI replied at least once. */
  sampleN: number;
  /** True when sampleN < MIN_SAMPLE_N — UI renders empty state instead. */
  belowThreshold: boolean;
  businessImpact: {
    aiConversations: number;
    bookingsGenerated: number;
    /** USD. service_orders.total_amount is already in dollars. */
    revenueGenerated: number;
    customersRecovered: number;
    responseTimeSavedHours: number;
  };
  performance: {
    /** 0..1 — bookings / conversations. 0 when no conversations. */
    conversionRate: number;
    avgResponseTimeSeconds: number;
    /** Same underlying data as bookingsGenerated — surfaced under both cards. */
    bookingsCreated: number;
  };
}

export interface MetricsAggregatorDeps {
  pool?: Pool;
}

export class MetricsAggregator {
  private readonly pool: Pool;

  constructor(deps: MetricsAggregatorDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
  }

  /**
   * Run the three aggregate queries and combine them into the response
   * shape the controller returns. Pure read; no writes.
   */
  async aggregate(args: {
    shopId: string;
    windowStart: MetricsWindow;
    /**
     * Optional exclusive upper bound (Phase 6 calendar-range support —
     * e.g. `last_month` = [prevMonthStart, currentMonthStart)). Omit /
     * pass null / undefined for rolling-from-now ranges + all-time.
     */
    windowEnd?: MetricsWindow;
    baselineMinutes: number;
  }): Promise<ImpactMetrics> {
    const { shopId, windowStart, windowEnd, baselineMinutes } = args;
    const windowEndArg: MetricsWindow = windowEnd ?? null;

    // The `($2::timestamp IS NULL OR ...)` form lets a single SQL string
    // serve both the 7/30/90d ranges and the all-time case without dynamic
    // SQL string building. Same idiom now used for the upper bound ($3).
    const [msgStats, orderStats, recovered] = await Promise.all([
      this.queryMessageStats(shopId, windowStart, windowEndArg),
      this.queryOrderStats(shopId, windowStart, windowEndArg),
      this.queryCustomersRecovered(shopId, windowStart, windowEndArg),
    ]);

    const aiConversations = msgStats.distinctConversations;
    const bookingsGenerated = orderStats.bookings;
    const revenueGenerated = orderStats.revenue;

    // Conversion rate clamps when there are zero conversations — division
    // would be NaN and the UI would render "—" or worse.
    const conversionRate =
      aiConversations > 0 ? bookingsGenerated / aiConversations : 0;

    // Response time saved is a counterfactual: (baseline - actual) for
    // each engagement the AI handled. Per scope-doc revision 2026-05-20
    // (Option A), we multiply by **distinct conversations**, not by every
    // AI reply — the per-reply formula compounded into unrealistic claims
    // on chatty conversations (3 conversations × ~100 replies ≈ 1163h).
    // Per-conversation matches the mental model: a human would engage once
    // per conversation, not once per AI message inside it.
    //
    // Guard: when there are zero successful replies, the AI didn't
    // actually engage with anyone — return 0 even if some conversations
    // exist (they would be failed-Claude conversations).
    //
    // Clamp to 0 when the AI is somehow slower than the baseline — showing
    // a negative number is misleading and the shop owner would distrust
    // the whole dashboard.
    const avgAiMinutes = msgStats.avgLatencyMs / 1000 / 60;
    const savingPerConversationMinutes = Math.max(
      0,
      baselineMinutes - avgAiMinutes
    );
    const responseTimeSavedHours =
      msgStats.successfulReplies === 0
        ? 0
        : (savingPerConversationMinutes * aiConversations) / 60;

    return {
      sampleN: aiConversations,
      belowThreshold: aiConversations < MIN_SAMPLE_N,
      businessImpact: {
        aiConversations,
        bookingsGenerated,
        revenueGenerated,
        customersRecovered: recovered,
        responseTimeSavedHours,
      },
      performance: {
        conversionRate,
        avgResponseTimeSeconds: msgStats.avgLatencyMs / 1000,
        bookingsCreated: bookingsGenerated,
      },
    };
  }

  /** Distinct conversations + successful-reply count + avg latency. */
  private async queryMessageStats(
    shopId: string,
    windowStart: MetricsWindow,
    windowEnd: MetricsWindow
  ): Promise<{
    distinctConversations: number;
    successfulReplies: number;
    avgLatencyMs: number;
  }> {
    const r = await this.pool.query<{
      distinct_conversations: string;
      successful_replies: string;
      avg_latency_ms: string | null;
    }>(
      `SELECT
         COUNT(DISTINCT conversation_id) AS distinct_conversations,
         COUNT(*) FILTER (WHERE response_payload IS NOT NULL) AS successful_replies,
         AVG(latency_ms) FILTER (WHERE response_payload IS NOT NULL) AS avg_latency_ms
       FROM ai_agent_messages
       WHERE shop_id = $1
         AND ($2::timestamp IS NULL OR created_at >= $2)
         AND ($3::timestamp IS NULL OR created_at < $3)`,
      [shopId, windowStart, windowEnd]
    );
    const row = r.rows[0];
    return {
      distinctConversations: parseInt(row.distinct_conversations, 10) || 0,
      successfulReplies: parseInt(row.successful_replies, 10) || 0,
      avgLatencyMs: row.avg_latency_ms ? parseFloat(row.avg_latency_ms) : 0,
    };
  }

  /**
   * Booking count + revenue from AI-originated orders. Excludes refunded,
   * cancelled, no-show, and expired — the shop only collects on paid +
   * completed. (Scope-doc Section 4 + Phase 2 acceptance criterion.)
   */
  private async queryOrderStats(
    shopId: string,
    windowStart: MetricsWindow,
    windowEnd: MetricsWindow
  ): Promise<{ bookings: number; revenue: number }> {
    const r = await this.pool.query<{
      bookings: string;
      revenue: string | null;
    }>(
      `SELECT
         COUNT(*) AS bookings,
         COALESCE(SUM(total_amount), 0) AS revenue
       FROM service_orders
       WHERE shop_id = $1
         AND ($2::timestamp IS NULL OR created_at >= $2)
         AND ($3::timestamp IS NULL OR created_at < $3)
         AND conversation_id IS NOT NULL
         AND status IN ('paid', 'completed')`,
      [shopId, windowStart, windowEnd]
    );
    const row = r.rows[0];
    return {
      bookings: parseInt(row.bookings, 10) || 0,
      revenue: row.revenue ? parseFloat(row.revenue) : 0,
    };
  }

  /**
   * Distinct customers who received a follow-up nudge AND booked within 7
   * days after, in the same conversation. The follow-up nudge is
   * identifiable by request_payload->>'source' = 'ai_followup' (see
   * AISalesFollowUpHandler — the source tag is written at write-time).
   *
   * The join on conversation_id is tighter than joining on customer_address
   * alone: we attribute the recovery to the specific conversation the nudge
   * was sent in, not just "this customer eventually booked something."
   */
  private async queryCustomersRecovered(
    shopId: string,
    windowStart: MetricsWindow,
    windowEnd: MetricsWindow
  ): Promise<number> {
    const r = await this.pool.query<{ recovered: string }>(
      `SELECT COUNT(DISTINCT m.customer_address) AS recovered
       FROM ai_agent_messages m
       JOIN service_orders o
         ON o.conversation_id = m.conversation_id
        AND o.shop_id = m.shop_id
       WHERE m.shop_id = $1
         AND ($2::timestamp IS NULL OR m.created_at >= $2)
         AND ($3::timestamp IS NULL OR m.created_at < $3)
         AND m.request_payload->>'source' = 'ai_followup'
         AND o.status IN ('paid', 'completed')
         AND o.created_at >= m.created_at
         AND o.created_at <= m.created_at + INTERVAL '7 days'`,
      [shopId, windowStart, windowEnd]
    );
    return parseInt(r.rows[0]?.recovered ?? "0", 10) || 0;
  }
}
