// backend/tests/ai-agent/insights/tools/aiAssistantImpact.test.ts
//
// Wrapper around MetricsAggregator — these tests confirm the tool
// hands the right inputs to the aggregator + maps its output into
// the ToolResult shape. Real aggregator math is exercised in
// MetricsAggregator.test.ts.

import { aiAssistantImpact } from "../../../../src/domains/AIAgentDomain/services/insights/tools/aiAssistantImpact";
import type { Pool } from "pg";

const makeMockPool = (rowsByQuery: Array<Array<any>>) => {
  const captured: Array<{ sql: string; params: unknown[] }> = [];
  const remaining = [...rowsByQuery];
  const query = jest.fn((sql: string, params?: unknown[]) => {
    captured.push({ sql, params: params ?? [] });
    return Promise.resolve({ rows: remaining.shift() ?? [] });
  });
  return { pool: { query } as unknown as Pool, captured, query };
};

const ctx = (shopId: string, mock: ReturnType<typeof makeMockPool>) => ({
  shopId,
  pool: mock.pool,
});

// Helper to build the 4-query sequence the tool issues:
//   [0] ai_shop_settings baseline lookup
//   [1] queryMessageStats (aggregator)
//   [2] queryOrderStats (aggregator)
//   [3] queryCustomersRecovered (aggregator)
const mockSequence = (opts: {
  baseline?: number | null;
  noBaselineRow?: boolean;
  distinctConversations?: number;
  successfulReplies?: number;
  avgLatencyMs?: number | null;
  bookings?: number;
  revenue?: number;
  recovered?: number;
}) =>
  makeMockPool([
    opts.noBaselineRow
      ? []
      : [{ human_reply_baseline_minutes: opts.baseline ?? 240 }],
    [
      {
        distinct_conversations: String(opts.distinctConversations ?? 0),
        successful_replies: String(opts.successfulReplies ?? 0),
        avg_latency_ms:
          opts.avgLatencyMs === undefined ? null : String(opts.avgLatencyMs),
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
  ]);

describe("ai_assistant_impact tool", () => {
  it("maps aggregator output into the ToolResult shape", async () => {
    const mock = mockSequence({
      baseline: 240,
      distinctConversations: 4,
      successfulReplies: 8,
      avgLatencyMs: 4500,
      bookings: 3,
      revenue: 1009.0,
      recovered: 1,
    });
    const result = await aiAssistantImpact.execute(
      { range: "30d" },
      ctx("peanut", mock)
    );

    const data = result.data as any;
    expect(data.range).toBe("30d");
    expect(data.baselineMinutes).toBe(240);
    expect(data.sampleN).toBe(4);
    expect(data.belowThreshold).toBe(true); // 4 < MIN_SAMPLE_N=5
    expect(data.businessImpact.aiConversations).toBe(4);
    expect(data.businessImpact.bookingsGenerated).toBe(3);
    expect(data.businessImpact.revenueGenerated).toBe(1009);
    expect(data.businessImpact.customersRecovered).toBe(1);
    expect(data.performance.conversionRate).toBeCloseTo(0.75, 2); // 3/4
  });

  it("display includes a Low sample warning when belowThreshold=true", async () => {
    const mock = mockSequence({
      distinctConversations: 4, // < 5 = below threshold
      successfulReplies: 4,
      bookings: 0,
      revenue: 0,
    });
    const result = await aiAssistantImpact.execute(
      { range: "all" },
      ctx("peanut", mock)
    );
    const display = result.display as Extract<typeof result.display, { kind: "list" }>;
    const lastItem = display.items[display.items.length - 1];
    expect(lastItem.label).toMatch(/Low sample/);
  });

  it("display does NOT include warning when sampleN >= MIN_SAMPLE_N", async () => {
    const mock = mockSequence({
      distinctConversations: 10,
      successfulReplies: 10,
      bookings: 5,
      revenue: 2000,
    });
    const result = await aiAssistantImpact.execute(
      { range: "all" },
      ctx("peanut", mock)
    );
    const display = result.display as Extract<typeof result.display, { kind: "list" }>;
    const labels = display.items.map((i) => i.label);
    expect(labels.some((l) => /Low sample/.test(l))).toBe(false);
  });

  it("display always opens with Window + the 7 metric rows", async () => {
    const mock = mockSequence({
      distinctConversations: 10,
      bookings: 5,
      revenue: 1500,
    });
    const result = await aiAssistantImpact.execute(
      { range: "7d" },
      ctx("peanut", mock)
    );
    const display = result.display as Extract<typeof result.display, { kind: "list" }>;
    const labels = display.items.map((i) => i.label);
    expect(labels[0]).toBe("Window");
    expect(labels).toContain("AI conversations");
    expect(labels).toContain("Bookings generated");
    expect(labels).toContain("Revenue generated");
    expect(labels).toContain("Conversion rate");
    expect(labels).toContain("Customers recovered");
    expect(labels).toContain("Time saved");
    expect(labels).toContain("Avg AI response time");
  });

  it("defaults baselineMinutes to 240 when ai_shop_settings row missing", async () => {
    const mock = mockSequence({ noBaselineRow: true });
    const result = await aiAssistantImpact.execute(
      { range: "all" },
      ctx("peanut", mock)
    );
    expect((result.data as any).baselineMinutes).toBe(240);
  });

  it("uses the shop's custom baseline when ai_shop_settings has one", async () => {
    const mock = mockSequence({ baseline: 60 });
    const result = await aiAssistantImpact.execute(
      { range: "all" },
      ctx("peanut", mock)
    );
    expect((result.data as any).baselineMinutes).toBe(60);
  });

  it("baseline query is shop-scoped via shop_id = $1", async () => {
    const mock = mockSequence({ baseline: 240 });
    await aiAssistantImpact.execute({ range: "all" }, ctx("shop-xyz", mock));
    // First query is the baseline fetch.
    expect(mock.captured[0].sql).toMatch(/ai_shop_settings/);
    expect(mock.captured[0].sql).toMatch(/shop_id = \$1/);
    expect(mock.captured[0].params[0]).toBe("shop-xyz");
  });

  it("throws on invalid range", async () => {
    const mock = makeMockPool([]);
    await expect(
      aiAssistantImpact.execute({ range: "yearly" }, ctx("peanut", mock))
    ).rejects.toThrow(/invalid range/);
  });
});
