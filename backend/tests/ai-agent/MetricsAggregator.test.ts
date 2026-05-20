// backend/tests/ai-agent/MetricsAggregator.test.ts
//
// Covers the math + response shape of MetricsAggregator.aggregate() and
// defends the critical SQL clauses against accidental removal.
//
// Real DISTINCT / status-exclusion behavior is enforced by Postgres at
// runtime; the structural SQL checks below catch the case where someone
// later edits the SQL and removes those guards by mistake.
//
// Companion smoke-test against real DO data:
//   backend/scripts/smoke-test-metrics-status-filter.ts

import { MetricsAggregator } from "../../src/domains/AIAgentDomain/services/MetricsAggregator";
import { MIN_SAMPLE_N } from "../../src/domains/AIAgentDomain/constants";

/**
 * Mock pool that queues row-arrays in the order queries are issued.
 * `aggregate()` runs three queries in this order under Promise.all:
 *   [0] queryMessageStats, [1] queryOrderStats, [2] queryCustomersRecovered.
 * Captures SQL text in `.queries` for structural assertions.
 */
const makePool = (rowsByQuery: Array<any[]>) => {
  const queries: string[] = [];
  return {
    queries,
    query: jest.fn().mockImplementation((sql: string) => {
      queries.push(sql);
      const next = rowsByQuery.shift();
      return Promise.resolve({ rows: next ?? [] });
    }),
  };
};

/** Build a queue of mock query results for one aggregate() call. */
const queueResults = (opts: {
  distinctConversations?: number;
  successfulReplies?: number;
  avgLatencyMs?: number | null;
  bookings?: number;
  revenue?: number;
  recovered?: number;
}) => [
  [
    {
      distinct_conversations: String(opts.distinctConversations ?? 0),
      successful_replies: String(opts.successfulReplies ?? 0),
      avg_latency_ms:
        opts.avgLatencyMs === undefined
          ? null
          : opts.avgLatencyMs === null
          ? null
          : String(opts.avgLatencyMs),
    },
  ],
  [
    {
      bookings: String(opts.bookings ?? 0),
      revenue:
        opts.revenue === undefined ? null : opts.revenue.toFixed(2),
    },
  ],
  [{ recovered: String(opts.recovered ?? 0) }],
];

describe("MetricsAggregator.aggregate — response shape", () => {
  it("maps the three query results into the ImpactMetrics shape", async () => {
    const pool = makePool(
      queueResults({
        distinctConversations: 12,
        successfulReplies: 30,
        avgLatencyMs: 4500, // 4.5s
        bookings: 3,
        revenue: 455.0,
        recovered: 2,
      })
    );
    const agg = new MetricsAggregator({ pool: pool as any });
    const r = await agg.aggregate({
      shopId: "peanut",
      windowStart: new Date("2026-05-01"),
      baselineMinutes: 240,
    });

    expect(r.sampleN).toBe(12);
    expect(r.belowThreshold).toBe(false);
    expect(r.businessImpact.aiConversations).toBe(12);
    expect(r.businessImpact.bookingsGenerated).toBe(3);
    expect(r.businessImpact.revenueGenerated).toBeCloseTo(455.0, 2);
    expect(r.businessImpact.customersRecovered).toBe(2);
    expect(r.performance.bookingsCreated).toBe(3); // mirrors bookingsGenerated
    expect(r.performance.avgResponseTimeSeconds).toBeCloseTo(4.5, 2);
  });

  it("returns zeros (not NaN) when nothing exists in the window", async () => {
    const pool = makePool(queueResults({}));
    const agg = new MetricsAggregator({ pool: pool as any });
    const r = await agg.aggregate({
      shopId: "peanut",
      windowStart: null,
      baselineMinutes: 240,
    });
    expect(r.sampleN).toBe(0);
    expect(r.belowThreshold).toBe(true);
    expect(r.businessImpact.aiConversations).toBe(0);
    expect(r.businessImpact.revenueGenerated).toBe(0);
    expect(r.businessImpact.responseTimeSavedHours).toBe(0);
    expect(r.performance.conversionRate).toBe(0); // no divide-by-zero NaN
    expect(r.performance.avgResponseTimeSeconds).toBe(0);
  });
});

describe("MetricsAggregator.aggregate — belowThreshold boundary", () => {
  it("flips at N = MIN_SAMPLE_N", async () => {
    // Sanity-check the constant we're testing against.
    expect(MIN_SAMPLE_N).toBe(5);

    const cases: Array<{ n: number; expected: boolean }> = [
      { n: 0, expected: true },
      { n: 4, expected: true },
      { n: MIN_SAMPLE_N - 1, expected: true },
      { n: MIN_SAMPLE_N, expected: false },
      { n: MIN_SAMPLE_N + 1, expected: false },
      { n: 100, expected: false },
    ];
    for (const c of cases) {
      const pool = makePool(
        queueResults({ distinctConversations: c.n })
      );
      const agg = new MetricsAggregator({ pool: pool as any });
      const r = await agg.aggregate({
        shopId: "peanut",
        windowStart: null,
        baselineMinutes: 240,
      });
      expect(r.belowThreshold).toBe(c.expected);
      expect(r.sampleN).toBe(c.n);
    }
  });
});

describe("MetricsAggregator.aggregate — conversionRate", () => {
  it("is 0 when there are no conversations (no NaN from division)", async () => {
    const pool = makePool(
      queueResults({ distinctConversations: 0, bookings: 0 })
    );
    const agg = new MetricsAggregator({ pool: pool as any });
    const r = await agg.aggregate({
      shopId: "peanut",
      windowStart: null,
      baselineMinutes: 240,
    });
    expect(r.performance.conversionRate).toBe(0);
    expect(Number.isFinite(r.performance.conversionRate)).toBe(true);
  });

  it("is bookings/conversations otherwise", async () => {
    const pool = makePool(
      queueResults({ distinctConversations: 10, bookings: 3 })
    );
    const agg = new MetricsAggregator({ pool: pool as any });
    const r = await agg.aggregate({
      shopId: "peanut",
      windowStart: null,
      baselineMinutes: 240,
    });
    expect(r.performance.conversionRate).toBeCloseTo(0.3, 4);
  });
});

describe("MetricsAggregator.aggregate — responseTimeSavedHours math", () => {
  // Per Option A (2026-05-20): per-CONVERSATION, not per-message.

  it("computes (baseline - avgMin) * conversations / 60 for a known fixture", async () => {
    // Baseline 240m. Avg latency 60_000ms = 1 minute. 10 conversations.
    // Saved per conversation = 239 min. Total = 239 * 10 = 2390 min ≈ 39.83h.
    // (successfulReplies is irrelevant to the multiplier — only the
    // > 0 guard cares about it.)
    const pool = makePool(
      queueResults({
        distinctConversations: 10,
        successfulReplies: 12,
        avgLatencyMs: 60_000,
      })
    );
    const agg = new MetricsAggregator({ pool: pool as any });
    const r = await agg.aggregate({
      shopId: "peanut",
      windowStart: null,
      baselineMinutes: 240,
    });
    expect(r.businessImpact.responseTimeSavedHours).toBeCloseTo(39.83, 1);
  });

  it("clamps to 0 when the AI is somehow slower than the baseline", async () => {
    // Baseline 5 minutes, avg latency 600_000ms = 10 minutes.
    // (5 - 10) clamped to 0, regardless of conversations.
    const pool = makePool(
      queueResults({
        distinctConversations: 8,
        successfulReplies: 4,
        avgLatencyMs: 600_000,
      })
    );
    const agg = new MetricsAggregator({ pool: pool as any });
    const r = await agg.aggregate({
      shopId: "peanut",
      windowStart: null,
      baselineMinutes: 5,
    });
    expect(r.businessImpact.responseTimeSavedHours).toBe(0);
  });

  it("returns 0 when there are no successful replies (even with conversations)", async () => {
    // 8 conversations existed but none had a successful Claude reply
    // (e.g., every call errored). The AI didn't actually engage, so the
    // shop didn't save anything — the > 0 guard handles this even though
    // the per-conversation multiplier would otherwise return non-zero.
    const pool = makePool(
      queueResults({
        distinctConversations: 8,
        successfulReplies: 0,
        avgLatencyMs: null,
      })
    );
    const agg = new MetricsAggregator({ pool: pool as any });
    const r = await agg.aggregate({
      shopId: "peanut",
      windowStart: null,
      baselineMinutes: 240,
    });
    expect(r.businessImpact.responseTimeSavedHours).toBe(0);
  });
});

describe("MetricsAggregator.aggregate — structural SQL guards", () => {
  // These tests defend the critical SQL clauses. They fail if someone
  // edits the SQL later and accidentally removes the protection — e.g.,
  // strips status filtering or removes the DISTINCT.

  it("queryOrderStats SQL filters status to paid + completed only", async () => {
    const pool = makePool(queueResults({}));
    const agg = new MetricsAggregator({ pool: pool as any });
    await agg.aggregate({
      shopId: "peanut",
      windowStart: null,
      baselineMinutes: 240,
    });
    const orderSql = pool.queries[1]; // second query is queryOrderStats
    expect(orderSql).toContain("status IN ('paid', 'completed')");
    expect(orderSql).toContain("conversation_id IS NOT NULL");
  });

  it("queryCustomersRecovered SQL uses COUNT(DISTINCT customer_address)", async () => {
    const pool = makePool(queueResults({}));
    const agg = new MetricsAggregator({ pool: pool as any });
    await agg.aggregate({
      shopId: "peanut",
      windowStart: null,
      baselineMinutes: 240,
    });
    const recoveredSql = pool.queries[2]; // third query
    // DISTINCT is what prevents a customer with multiple nudges from
    // being counted twice in the same window.
    expect(recoveredSql).toMatch(/COUNT\s*\(\s*DISTINCT\s+m\.customer_address/);
    // Confirms we're only counting nudges, not every AI reply.
    expect(recoveredSql).toContain("'ai_followup'");
    // 7-day attribution window.
    expect(recoveredSql).toContain("INTERVAL '7 days'");
  });

  it("queryMessageStats SQL counts only successful replies for latency math", async () => {
    const pool = makePool(queueResults({}));
    const agg = new MetricsAggregator({ pool: pool as any });
    await agg.aggregate({
      shopId: "peanut",
      windowStart: null,
      baselineMinutes: 240,
    });
    const msgSql = pool.queries[0];
    expect(msgSql).toContain("response_payload IS NOT NULL");
    expect(msgSql).toContain("COUNT(DISTINCT conversation_id)");
  });
});
