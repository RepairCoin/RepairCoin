// backend/tests/ai-agent/insights/tools/bookingsBreakdown.test.ts

import { bookingsBreakdown } from "../../../../src/domains/AIAgentDomain/services/insights/tools/bookingsBreakdown";
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

const CANONICAL = [
  "completed",
  "paid",
  "pending",
  "cancelled",
  "no_show",
  "expired",
  "refunded",
];

describe("bookings_breakdown tool", () => {
  describe("byStatus + display contract", () => {
    it("returns all 7 canonical statuses even when DB has only some", async () => {
      // DB returns only 3 statuses; the tool must zero-fill the other 4.
      const mock = makeMockPool([
        [
          { status: "completed", n: "10" },
          { status: "cancelled", n: "5" },
          { status: "no_show", n: "2" },
        ],
      ]);
      const result = await bookingsBreakdown.execute(
        { range: "30d" },
        ctx("peanut", mock)
      );

      const data = result.data as { byStatus: Record<string, number> };
      for (const s of CANONICAL) {
        expect(data.byStatus).toHaveProperty(s);
        expect(typeof data.byStatus[s]).toBe("number");
      }
      expect(data.byStatus.completed).toBe(10);
      expect(data.byStatus.cancelled).toBe(5);
      expect(data.byStatus.no_show).toBe(2);
      expect(data.byStatus.pending).toBe(0);
      expect(data.byStatus.refunded).toBe(0);
    });

    it("total is the sum of all status counts", async () => {
      const mock = makeMockPool([
        [
          { status: "completed", n: "10" },
          { status: "cancelled", n: "5" },
        ],
      ]);
      const result = await bookingsBreakdown.execute(
        { range: "all" },
        ctx("peanut", mock)
      );
      expect((result.data as { total: number }).total).toBe(15);
    });

    it("display.items[0] is 'Total bookings' with the total count", async () => {
      const mock = makeMockPool([
        [{ status: "completed", n: "7" }],
      ]);
      const result = await bookingsBreakdown.execute(
        { range: "7d" },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "list" }>;
      expect(display.items[0]).toEqual({ label: "Total bookings", value: "7" });
    });

    it("formats values as 'N (X.X%)' when present, plain '0' when absent", async () => {
      const mock = makeMockPool([
        [
          { status: "completed", n: "75" },
          { status: "cancelled", n: "25" },
        ],
      ]);
      const result = await bookingsBreakdown.execute(
        { range: "30d" },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "list" }>;
      const completed = display.items.find((i) => i.label === "Completed");
      const refunded = display.items.find((i) => i.label === "Refunded");
      expect(completed?.value).toBe("75 (75.0%)");
      expect(refunded?.value).toBe("0");
    });

    it("returns all '0' values when window is empty", async () => {
      const mock = makeMockPool([[]]);
      const result = await bookingsBreakdown.execute(
        { range: "7d" },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "list" }>;
      // First item is total (also '0'), then 7 canonical statuses all '0'.
      const valuesAfterTotal = display.items.slice(1).map((i) => i.value);
      expect(valuesAfterTotal.every((v) => v === "0")).toBe(true);
    });
  });

  describe("forward-compat for new statuses", () => {
    it("appends non-canonical statuses after the canonical block, alphabetized", async () => {
      const mock = makeMockPool([
        [
          { status: "completed", n: "5" },
          { status: "zomega_status", n: "1" },
          { status: "alpha_status", n: "2" },
        ],
      ]);
      const result = await bookingsBreakdown.execute(
        { range: "all" },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "list" }>;
      const labels = display.items.map((i) => i.label);
      // total + 7 canonical = first 8 items, then 2 extras alphabetized.
      const extras = labels.slice(8);
      // defaultLabel() capitalizes EACH word of the split (alpha_status →
      // "Alpha Status"), not just the first letter of the whole label.
      expect(extras).toEqual(["Alpha Status", "Zomega Status"]);
    });
  });

  describe("SQL structural guards", () => {
    it("shop-scopes via shop_id = $1 with ctx.shopId", async () => {
      const mock = makeMockPool([[]]);
      await bookingsBreakdown.execute(
        { range: "all" },
        ctx("shop-zzz", mock)
      );
      expect(mock.captured[0].sql).toMatch(/shop_id = \$1/);
      expect(mock.captured[0].params[0]).toBe("shop-zzz");
    });

    it("GROUP BY status", async () => {
      const mock = makeMockPool([[]]);
      await bookingsBreakdown.execute(
        { range: "all" },
        ctx("peanut", mock)
      );
      expect(mock.captured[0].sql).toMatch(/GROUP BY status/);
    });

    it("range='all' omits created_at lower bound", async () => {
      const mock = makeMockPool([[]]);
      await bookingsBreakdown.execute(
        { range: "all" },
        ctx("peanut", mock)
      );
      expect(mock.captured[0].sql).not.toMatch(/created_at >=/);
      expect(mock.captured[0].params).toEqual(["peanut"]);
    });

    it("range='7d' adds created_at lower bound", async () => {
      const mock = makeMockPool([[]]);
      await bookingsBreakdown.execute(
        { range: "7d" },
        ctx("peanut", mock)
      );
      expect(mock.captured[0].sql).toMatch(/created_at >= \$2/);
      expect(mock.captured[0].params.length).toBe(2);
    });
  });

  describe("args validation", () => {
    it("throws on invalid range", async () => {
      const mock = makeMockPool([]);
      await expect(
        bookingsBreakdown.execute({ range: "yearly" }, ctx("peanut", mock))
      ).rejects.toThrow(/invalid range/);
    });
  });
});
