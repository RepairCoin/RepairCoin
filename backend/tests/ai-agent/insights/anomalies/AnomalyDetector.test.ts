// backend/tests/ai-agent/insights/anomalies/AnomalyDetector.test.ts
//
// Mock-pool + mock-metrics tests for the Phase 7.2 detector. Real
// production metric SQL is exercised by smoke-script + the dry-run
// week on DO; this file proves the detector's classification logic
// (severity bands, noise-floor skipping, sentiment mapping,
// persistence INSERT shape).

import { AnomalyDetector } from "../../../../src/domains/AIAgentDomain/services/insights/anomalies/AnomalyDetector";
import type {
  MetricDefinition,
} from "../../../../src/domains/AIAgentDomain/services/insights/anomalies/types";
import type { Pool } from "pg";

const makeMockPool = () => {
  const captured: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn((sql: string, params?: unknown[]) => {
    captured.push({ sql, params: params ?? [] });
    return Promise.resolve({ rows: [] }); // INSERT returns nothing meaningful
  });
  return { pool: { query } as unknown as Pool, captured, query };
};

const fakeMetric = (
  key: string,
  current: number,
  prior: number,
  opts: Partial<MetricDefinition> = {}
): MetricDefinition => ({
  key: key as MetricDefinition["key"],
  label: opts.label ?? "Test",
  upIsGood: opts.upIsGood ?? true,
  minPriorSignal: opts.minPriorSignal ?? 1,
  async compute() {
    return { current, prior };
  },
});

describe("AnomalyDetector", () => {
  describe("classification", () => {
    it("flags as 'high' when |deltaPct| ≥ 150%", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_revenue", 3000, 1000)], // +200%
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged).toHaveLength(1);
      expect(flagged[0].severity).toBe("high");
      expect(flagged[0].deltaPct).toBeCloseTo(200, 0);
    });

    it("flags as 'medium' when 60% ≤ |deltaPct| < 150%", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_revenue", 1800, 1000)], // +80%
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged[0].severity).toBe("medium");
    });

    it("flags as 'low' when 30% ≤ |deltaPct| < 60%", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_revenue", 1400, 1000)], // +40%
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged[0].severity).toBe("low");
    });

    it("does NOT flag when |deltaPct| < 30%", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_revenue", 1200, 1000)], // +20%
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged).toHaveLength(0);
    });

    it("works for negative direction (revenue dropping)", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_revenue", 200, 1000)], // -80%
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged[0].severity).toBe("medium");
      expect(flagged[0].deltaPct).toBeCloseTo(-80, 0);
      expect(flagged[0].sentiment).toBe("negative"); // revenue down = bad
    });
  });

  describe("noise floor (minPriorSignal)", () => {
    it("skips a metric when prior < minPriorSignal", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [
          fakeMetric("weekly_revenue", 50, 10, { minPriorSignal: 50 }), // prior $10 < $50 floor
        ],
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged).toHaveLength(0);
    });

    it("skips a metric when prior === 0 (would be Infinity%)", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_revenue", 1000, 0, { minPriorSignal: 50 })],
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged).toHaveLength(0);
    });
  });

  describe("sentiment mapping (upIsGood)", () => {
    it("upIsGood=true + delta up = positive (revenue ↑ is good)", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_revenue", 1500, 1000, { upIsGood: true })],
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged[0].sentiment).toBe("positive");
    });

    it("upIsGood=true + delta down = negative (revenue ↓ is bad)", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_revenue", 500, 1000, { upIsGood: true })],
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged[0].sentiment).toBe("negative");
    });

    it("upIsGood=false + delta up = negative (no-shows ↑ is bad)", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_no_shows", 12, 3, { upIsGood: false })],
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged[0].sentiment).toBe("negative");
    });

    it("upIsGood=false + delta down = positive (no-shows ↓ is good)", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_no_shows", 1, 5, { upIsGood: false })],
      });
      const flagged = await d.runDetection("shop-x");
      expect(flagged[0].sentiment).toBe("positive");
    });
  });

  describe("persistence", () => {
    it("INSERTs a row per flagged anomaly with the correct columns", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_revenue", 2000, 1000)], // +100% → medium
      });
      await d.runDetection("shop-z");

      // Only one INSERT (no metric.compute query captured — compute is fake).
      expect(mock.captured).toHaveLength(1);
      const insert = mock.captured[0];
      expect(insert.sql).toMatch(/INSERT INTO ai_insights_anomalies/);
      expect(insert.sql).toMatch(/NOW\(\) \+ INTERVAL '14 days'/);
      // Param order: shopId, metricKey, current, prior, delta, deltaPct, severity
      expect(insert.params[0]).toBe("shop-z");
      expect(insert.params[1]).toBe("weekly_revenue");
      expect(insert.params[2]).toBe(2000);
      expect(insert.params[3]).toBe(1000);
      expect(insert.params[4]).toBe(1000);
      expect(insert.params[5]).toBeCloseTo(100, 0);
      expect(insert.params[6]).toBe("medium");
    });

    it("does NOT INSERT when no metrics flag", async () => {
      const mock = makeMockPool();
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [fakeMetric("weekly_revenue", 1100, 1000)], // +10% < 30%
      });
      await d.runDetection("shop-z");
      expect(mock.captured).toHaveLength(0);
    });
  });

  describe("error resilience", () => {
    it("logs + skips when a metric's compute() throws — doesn't sink the rest", async () => {
      const mock = makeMockPool();
      const exploding: MetricDefinition = {
        key: "weekly_revenue",
        label: "Boom",
        upIsGood: true,
        minPriorSignal: 1,
        async compute() {
          throw new Error("synthetic compute failure");
        },
      };
      const fine = fakeMetric("weekly_no_shows", 12, 3, { upIsGood: false });
      const d = new AnomalyDetector({
        pool: mock.pool,
        metrics: [exploding, fine],
      });
      const flagged = await d.runDetection("shop-z");
      // The fine metric still flagged + persisted.
      expect(flagged).toHaveLength(1);
      expect(flagged[0].metricKey).toBe("weekly_no_shows");
      expect(mock.captured).toHaveLength(1); // 1 INSERT
    });

    it("logs + skips when persist INSERT throws — runDetection still returns the flag", async () => {
      const queryThatThrows = jest.fn().mockRejectedValue(new Error("db down"));
      const brokenPool = { query: queryThatThrows } as unknown as Pool;
      const d = new AnomalyDetector({
        pool: brokenPool,
        metrics: [fakeMetric("weekly_revenue", 2000, 1000)],
      });
      // Should NOT throw at the top level.
      const flagged = await d.runDetection("shop-z");
      expect(flagged).toHaveLength(1);
    });
  });
});
