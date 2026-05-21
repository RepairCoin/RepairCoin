// backend/tests/ai-agent/insights/tools/revenueSummary.test.ts
//
// Math correctness on a mocked SQL result + structural assertions on
// the SQL itself (shop-scoping, status filter). Real DB exercise lives
// in backend/scripts/smoke-tool-revenue-summary.ts.

import { revenueSummary } from "../../../../src/domains/AIAgentDomain/services/insights/tools/revenueSummary";
import type { Pool } from "pg";

// Inline mock-pool helper (duplicated across tool tests rather than
// shared in a helpers.ts — keeps tests self-contained and avoids
// leaking jest types into the production tsconfig).
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

describe("revenue_summary tool", () => {
  describe("single window", () => {
    it("returns number display + correct totals for range='7d'", async () => {
      const mock = makeMockPool([[{ total: "2117.00", n: "7" }]]);
      const result = await revenueSummary.execute(
        { range: "7d" },
        ctx("peanut", mock)
      );

      expect(result.data).toEqual({
        range: "7d",
        totalUsd: 2117,
        orderCount: 7,
      });
      expect(result.display).toEqual({
        kind: "number",
        primary: "$2,117.00",
        label: "Revenue (last 7 days)",
        sub: "7 paid + completed orders",
      });
    });

    it("returns $0.00 + '0 paid + completed orders' on empty result", async () => {
      const mock = makeMockPool([[{ total: "0", n: "0" }]]);
      const result = await revenueSummary.execute(
        { range: "30d" },
        ctx("peanut", mock)
      );

      expect(result.data.totalUsd).toBe(0);
      const display = result.display as Extract<typeof result.display, { kind: "number" }>;
      expect(display?.primary).toBe("$0.00");
      expect(display?.sub).toBe("0 paid + completed orders");
    });

    it("pluralizes 'order' correctly for n=1", async () => {
      const mock = makeMockPool([[{ total: "50.00", n: "1" }]]);
      const result = await revenueSummary.execute(
        { range: "7d" },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "number" }>;
      expect(display?.sub).toBe("1 paid + completed order");
    });

    it("range='all' omits the lower-bound filter (only 1 param)", async () => {
      const mock = makeMockPool([[{ total: "7783.02", n: "23" }]]);
      await revenueSummary.execute({ range: "all" }, ctx("peanut", mock));
      // SQL should have shop_id condition but no created_at lower bound.
      expect(mock.captured[0].params).toEqual(["peanut"]);
      expect(mock.captured[0].sql).not.toMatch(/created_at >=/);
    });

    it("range='7d' includes created_at lower-bound filter (2 params)", async () => {
      const mock = makeMockPool([[{ total: "2117.00", n: "7" }]]);
      await revenueSummary.execute({ range: "7d" }, ctx("peanut", mock));
      expect(mock.captured[0].params.length).toBe(2);
      expect(mock.captured[0].params[0]).toBe("peanut");
      expect(mock.captured[0].params[1]).toBeInstanceOf(Date);
      expect(mock.captured[0].sql).toMatch(/created_at >= \$2/);
    });
  });

  describe("compare='prior'", () => {
    it("issues TWO queries, returns list display with delta", async () => {
      const mock = makeMockPool([
        [{ total: "2117.00", n: "7" }], // current
        [{ total: "1000.00", n: "3" }], // prior
      ]);
      const result = await revenueSummary.execute(
        { range: "7d", compare: "prior" },
        ctx("peanut", mock)
      );

      expect(mock.query).toHaveBeenCalledTimes(2);
      expect(result.data).toMatchObject({
        range: "7d",
        current: { totalUsd: 2117, orderCount: 7 },
        prior: { totalUsd: 1000, orderCount: 3 },
      });
      const data = result.data as { deltaPct: number };
      expect(data.deltaPct).toBeCloseTo(111.7, 1);
      const display = result.display as Extract<typeof result.display, { kind: "list" }>;
      expect(display?.kind).toBe("list");
      expect(display?.items).toHaveLength(3);
    });

    it("deltaPct = null when prior = 0 (no divide-by-zero)", async () => {
      const mock = makeMockPool([
        [{ total: "2117.00", n: "7" }],
        [{ total: "0", n: "0" }],
      ]);
      const result = await revenueSummary.execute(
        { range: "7d", compare: "prior" },
        ctx("peanut", mock)
      );
      const data = result.data as { deltaPct: number | null };
      expect(data.deltaPct).toBeNull();
    });

    it("range='all' + compare='prior' returns comparisonUnsupported flag", async () => {
      const mock = makeMockPool([[{ total: "7783.02", n: "23" }]]);
      const result = await revenueSummary.execute(
        { range: "all", compare: "prior" },
        ctx("peanut", mock)
      );
      expect(mock.query).toHaveBeenCalledTimes(1); // no second query
      expect(result.data).toMatchObject({
        range: "all",
        comparisonUnsupported: true,
      });
      const data = result.data as { comparisonReason: string };
      expect(data.comparisonReason).toMatch(/not supported/);
    });
  });

  describe("SQL structural guards (regression defense)", () => {
    it("SQL hardcodes shop_id = $1 with ctx.shopId as the first param", async () => {
      const mock = makeMockPool([[{ total: "0", n: "0" }]]);
      await revenueSummary.execute({ range: "all" }, ctx("shop-xyz", mock));
      expect(mock.captured[0].sql).toMatch(/shop_id = \$1/);
      expect(mock.captured[0].params[0]).toBe("shop-xyz");
    });

    it("SQL filters status IN ('paid', 'completed')", async () => {
      const mock = makeMockPool([[{ total: "0", n: "0" }]]);
      await revenueSummary.execute({ range: "all" }, ctx("peanut", mock));
      expect(mock.captured[0].sql).toMatch(
        /status IN \(\s*'paid'\s*,\s*'completed'\s*\)/
      );
    });

    it("SQL queries service_orders (the canonical revenue source)", async () => {
      const mock = makeMockPool([[{ total: "0", n: "0" }]]);
      await revenueSummary.execute({ range: "all" }, ctx("peanut", mock));
      expect(mock.captured[0].sql).toMatch(/FROM service_orders/);
    });
  });

  describe("args validation (defense — dispatcher validates first)", () => {
    it("throws on invalid range", async () => {
      const mock = makeMockPool([]);
      await expect(
        revenueSummary.execute({ range: "yearly" }, ctx("peanut", mock))
      ).rejects.toThrow(/invalid range/);
      expect(mock.query).not.toHaveBeenCalled();
    });

    it("throws on invalid compare", async () => {
      const mock = makeMockPool([]);
      await expect(
        revenueSummary.execute(
          { range: "7d", compare: "next" },
          ctx("peanut", mock)
        )
      ).rejects.toThrow(/invalid compare/);
    });

    it("throws on non-object args", async () => {
      const mock = makeMockPool([]);
      await expect(
        revenueSummary.execute("not an object", ctx("peanut", mock))
      ).rejects.toThrow(/args must be an object/);
    });
  });
});
