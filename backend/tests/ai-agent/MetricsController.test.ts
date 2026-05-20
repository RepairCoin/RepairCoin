// backend/tests/ai-agent/MetricsController.test.ts
//
// Covers GET /api/ai/metrics:
//   - pure helpers (parseMetricsRange, windowStartForRange)
//   - auth + validation behavior
//   - baseline-fallback when shop has no settings row
//   - cache hit / cache miss after TTL
//
// Cache tests use the injectable `now` + `cacheTtlMs` deps the controller
// exposes — no jest fake timers needed.

import {
  makeMetricsController,
  parseMetricsRange,
  windowStartForRange,
  DEFAULT_METRICS_RANGE,
} from "../../src/domains/AIAgentDomain/controllers/MetricsController";
import { MetricsAggregator } from "../../src/domains/AIAgentDomain/services/MetricsAggregator";

const makeReq = (opts: { user?: any; query?: any } = {}) =>
  ({ user: opts.user ?? {}, query: opts.query ?? {} } as any);

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makePool = (rowsByQuery: Array<any[]>) => ({
  query: jest.fn().mockImplementation(() => {
    const next = rowsByQuery.shift();
    return Promise.resolve({ rows: next ?? [] });
  }),
});

// ----- Pure helpers -----

describe("parseMetricsRange", () => {
  it("defaults to 30d when absent", () => {
    expect(parseMetricsRange(undefined)).toEqual({
      ok: true,
      value: DEFAULT_METRICS_RANGE,
    });
    expect(parseMetricsRange(null)).toEqual({
      ok: true,
      value: DEFAULT_METRICS_RANGE,
    });
    expect(parseMetricsRange("")).toEqual({
      ok: true,
      value: DEFAULT_METRICS_RANGE,
    });
  });

  it.each(["7d", "30d", "90d", "all"] as const)("accepts %s", (v) => {
    const r = parseMetricsRange(v);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(v);
  });

  it("rejects unknown values", () => {
    const r = parseMetricsRange("lol");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/range must be one of/);
  });

  it("rejects non-strings", () => {
    expect(parseMetricsRange(7).ok).toBe(false);
    expect(parseMetricsRange({}).ok).toBe(false);
    expect(parseMetricsRange([]).ok).toBe(false);
  });
});

describe("windowStartForRange", () => {
  it("returns null for 'all'", () => {
    expect(windowStartForRange("all")).toBeNull();
  });

  it("returns a Date roughly N days ago for 7d/30d/90d", () => {
    const now = Date.now();
    const cases: Array<{ range: "7d" | "30d" | "90d"; days: number }> = [
      { range: "7d", days: 7 },
      { range: "30d", days: 30 },
      { range: "90d", days: 90 },
    ];
    for (const c of cases) {
      const start = windowStartForRange(c.range)!;
      const expectedMs = now - c.days * 24 * 60 * 60 * 1000;
      // Allow 5s of clock drift between the constant and the function call.
      expect(Math.abs(start.getTime() - expectedMs)).toBeLessThan(5000);
    }
  });
});

// ----- getMetrics handler -----

/** Minimal aggregator stub — counts calls + returns a fixed payload. */
const makeAggregatorStub = (overrides?: any) => {
  const aggregate = jest.fn().mockResolvedValue({
    sampleN: 12,
    belowThreshold: false,
    businessImpact: {
      aiConversations: 12,
      bookingsGenerated: 3,
      revenueGenerated: 455,
      customersRecovered: 2,
      responseTimeSavedHours: 8.4,
    },
    performance: {
      conversionRate: 0.25,
      avgResponseTimeSeconds: 4.5,
      bookingsCreated: 3,
    },
    ...overrides,
  });
  // Cast to MetricsAggregator — only `aggregate` is exercised.
  return { aggregate } as unknown as MetricsAggregator;
};

describe("MetricsController.getMetrics — auth + validation", () => {
  it("returns 401 when there is no shopId on the JWT", async () => {
    const controller = makeMetricsController({
      pool: makePool([]) as any,
      aggregator: makeAggregatorStub(),
    });
    const res = makeRes();
    await controller.getMetrics(makeReq({ user: { role: "shop" } }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 on an unknown range value", async () => {
    const controller = makeMetricsController({
      pool: makePool([]) as any,
      aggregator: makeAggregatorStub(),
    });
    const res = makeRes();
    await controller.getMetrics(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        query: { range: "lol" },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("MetricsController.getMetrics — happy path + baseline", () => {
  it("returns the combined response shape with the shop's baseline", async () => {
    // First query in the controller is fetchBaselineMinutes →
    // [{ human_reply_baseline_minutes: 120 }].
    const pool = makePool([[{ human_reply_baseline_minutes: 120 }]]);
    const aggregator = makeAggregatorStub();
    const controller = makeMetricsController({
      pool: pool as any,
      aggregator,
    });
    const res = makeRes();
    await controller.getMetrics(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        query: { range: "30d" },
      }),
      res
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        range: "30d",
        baselineMinutes: 120,
        sampleN: 12,
        belowThreshold: false,
      }),
    });
    expect(aggregator.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: "peanut", baselineMinutes: 120 })
    );
  });

  it("falls back to 240 when the shop has no settings row", async () => {
    // Empty result from the baseline query → controller defaults to 240.
    const pool = makePool([[]]);
    const aggregator = makeAggregatorStub();
    const controller = makeMetricsController({
      pool: pool as any,
      aggregator,
    });
    const res = makeRes();
    await controller.getMetrics(
      makeReq({
        user: { role: "shop", shopId: "newly-baker" },
        query: { range: "30d" },
      }),
      res
    );
    expect(aggregator.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ baselineMinutes: 240 })
    );
  });
});

describe("MetricsController.getMetrics — response cache", () => {
  it("serves the second call within TTL from cache (no second aggregator call)", async () => {
    // Two baseline reads queued so we know the second read would fail if
    // the cache didn't intercept first.
    const pool = makePool([
      [{ human_reply_baseline_minutes: 240 }],
      [{ human_reply_baseline_minutes: 240 }],
    ]);
    const aggregator = makeAggregatorStub();
    let nowMs = 1_000_000_000_000;
    const controller = makeMetricsController({
      pool: pool as any,
      aggregator,
      now: () => nowMs,
      cacheTtlMs: 60_000,
    });

    const req = () =>
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        query: { range: "30d" },
      });

    await controller.getMetrics(req(), makeRes());
    expect(aggregator.aggregate).toHaveBeenCalledTimes(1);

    // Same key, 30 seconds later — still within TTL.
    nowMs += 30_000;
    await controller.getMetrics(req(), makeRes());
    expect(aggregator.aggregate).toHaveBeenCalledTimes(1);
  });

  it("refetches after the TTL has expired", async () => {
    const pool = makePool([
      [{ human_reply_baseline_minutes: 240 }],
      [{ human_reply_baseline_minutes: 240 }],
    ]);
    const aggregator = makeAggregatorStub();
    let nowMs = 1_000_000_000_000;
    const controller = makeMetricsController({
      pool: pool as any,
      aggregator,
      now: () => nowMs,
      cacheTtlMs: 60_000,
    });

    const req = () =>
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        query: { range: "30d" },
      });

    await controller.getMetrics(req(), makeRes());
    expect(aggregator.aggregate).toHaveBeenCalledTimes(1);

    // 61 seconds later — entry expired.
    nowMs += 61_000;
    await controller.getMetrics(req(), makeRes());
    expect(aggregator.aggregate).toHaveBeenCalledTimes(2);
  });

  it("keys the cache by (shopId, range) — different range refetches", async () => {
    const pool = makePool([
      [{ human_reply_baseline_minutes: 240 }],
      [{ human_reply_baseline_minutes: 240 }],
    ]);
    const aggregator = makeAggregatorStub();
    const controller = makeMetricsController({
      pool: pool as any,
      aggregator,
      cacheTtlMs: 60_000,
    });

    await controller.getMetrics(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        query: { range: "30d" },
      }),
      makeRes()
    );
    await controller.getMetrics(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        query: { range: "7d" },
      }),
      makeRes()
    );
    expect(aggregator.aggregate).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed response (errors aren't poisoning the cache)", async () => {
    const pool = makePool([
      [{ human_reply_baseline_minutes: 240 }],
      [{ human_reply_baseline_minutes: 240 }],
    ]);
    const aggregator = {
      aggregate: jest
        .fn()
        .mockRejectedValueOnce(new Error("transient"))
        .mockResolvedValueOnce({
          sampleN: 12,
          belowThreshold: false,
          businessImpact: {
            aiConversations: 12,
            bookingsGenerated: 3,
            revenueGenerated: 455,
            customersRecovered: 2,
            responseTimeSavedHours: 8.4,
          },
          performance: {
            conversionRate: 0.25,
            avgResponseTimeSeconds: 4.5,
            bookingsCreated: 3,
          },
        }),
    } as unknown as MetricsAggregator;
    const controller = makeMetricsController({
      pool: pool as any,
      aggregator,
      cacheTtlMs: 60_000,
    });

    const res1 = makeRes();
    await controller.getMetrics(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        query: { range: "30d" },
      }),
      res1
    );
    expect(res1.status).toHaveBeenCalledWith(500);

    // Same (shopId, range) — a failed response must NOT have been
    // cached, so the second call hits the aggregator again.
    const res2 = makeRes();
    await controller.getMetrics(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        query: { range: "30d" },
      }),
      res2
    );
    expect(res2.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
    expect(aggregator.aggregate).toHaveBeenCalledTimes(2);
  });
});
