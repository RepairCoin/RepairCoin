// backend/tests/ai-agent/insights/tools/topCustomers.test.ts
//
// Math + display + SQL structural checks. Real DB exercise lives in
// backend/scripts/smoke-tool-top-customers.ts.

import { topCustomers } from "../../../../src/domains/AIAgentDomain/services/insights/tools/topCustomers";
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

const rawRow = (overrides: Partial<{
  customer_address: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  n: string;
  total: string;
  rcn: string;
}> = {}) => ({
  customer_address: "0xaaaa1111bbbb2222cccc3333dddd4444eeee5555",
  name: null,
  first_name: null,
  last_name: null,
  email: null,
  n: "3",
  total: "150.00",
  rcn: "30",
  ...overrides,
});

describe("top_customers tool", () => {
  describe("by='spend'", () => {
    it("returns table display with Spend column + USD-formatted values", async () => {
      const mock = makeMockPool([
        [
          rawRow({ name: "Qua Ting", n: "12", total: "4938.02" }),
          rawRow({ name: "mike", n: "3", total: "1172.00" }),
        ],
      ]);
      const result = await topCustomers.execute(
        { range: "all", by: "spend", limit: 5 },
        ctx("peanut", mock)
      );

      expect(result.data).toMatchObject({
        range: "all",
        by: "spend",
        count: 2,
      });
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.kind).toBe("table");
      expect(display.columns).toEqual(["#", "Customer", "Spend"]);
      expect(display.rows[0]).toEqual([1, "Qua Ting", "$4,938.02"]);
      expect(display.rows[1]).toEqual([2, "mike", "$1,172.00"]);
    });

    it("ORDER BY uses SUM(total_amount) DESC for spend", async () => {
      const mock = makeMockPool([[rawRow()]]);
      await topCustomers.execute(
        { range: "all", by: "spend", limit: 5 },
        ctx("peanut", mock)
      );
      expect(mock.captured[0].sql).toMatch(/ORDER BY SUM\(o\.total_amount\) DESC/);
    });
  });

  describe("by='order_count'", () => {
    it("returns table display with Orders column + integer values", async () => {
      const mock = makeMockPool([
        [rawRow({ email: "a@b.com", n: "12", total: "4938.02" })],
      ]);
      const result = await topCustomers.execute(
        { range: "30d", by: "order_count", limit: 5 },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.columns[2]).toBe("Orders");
      expect(display.rows[0][2]).toBe("12"); // formatted as plain integer string
    });

    it("ORDER BY tie-breaks by SUM(total_amount) DESC for deterministic ranking", async () => {
      const mock = makeMockPool([[rawRow()]]);
      await topCustomers.execute(
        { range: "all", by: "order_count", limit: 5 },
        ctx("peanut", mock)
      );
      expect(mock.captured[0].sql).toMatch(
        /ORDER BY COUNT\(\*\) DESC, SUM\(o\.total_amount\) DESC/
      );
    });
  });

  describe("by='rcn_earned'", () => {
    it("queries transactions table, not service_orders", async () => {
      const mock = makeMockPool([[rawRow({ rcn: "375" })]]);
      await topCustomers.execute(
        { range: "all", by: "rcn_earned", limit: 5 },
        ctx("peanut", mock)
      );
      expect(mock.captured[0].sql).toMatch(/FROM transactions/);
      expect(mock.captured[0].sql).not.toMatch(/FROM service_orders/);
    });

    it("filters transactions.type IN ('mint', 'tier_bonus')", async () => {
      const mock = makeMockPool([[rawRow({ rcn: "375" })]]);
      await topCustomers.execute(
        { range: "all", by: "rcn_earned", limit: 5 },
        ctx("peanut", mock)
      );
      expect(mock.captured[0].sql).toMatch(
        /type IN \(\s*'mint'\s*,\s*'tier_bonus'\s*\)/
      );
    });

    it("formats RCN as integer when whole (e.g. '375 RCN')", async () => {
      const mock = makeMockPool([[rawRow({ rcn: "375" })]]);
      const result = await topCustomers.execute(
        { range: "all", by: "rcn_earned", limit: 5 },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.rows[0][2]).toBe("375 RCN");
    });

    it("formats RCN with 2 decimals when fractional", async () => {
      const mock = makeMockPool([[rawRow({ rcn: "73.50" })]]);
      const result = await topCustomers.execute(
        { range: "all", by: "rcn_earned", limit: 5 },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      // .toFixed(2) preserves trailing zero — "73.50" not "73.5".
      expect(display.rows[0][2]).toBe("73.50 RCN");
    });
  });

  describe("customer name resolution (COALESCE chain)", () => {
    it("prefers `name` when set", async () => {
      const mock = makeMockPool([
        [rawRow({ name: "Qua Ting", first_name: "Ignored", email: "x@y.com" })],
      ]);
      const result = await topCustomers.execute(
        { range: "all", by: "spend", limit: 5 },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.rows[0][1]).toBe("Qua Ting");
    });

    it("falls back to trimmed first+last when `name` is null", async () => {
      const mock = makeMockPool([
        [
          rawRow({
            name: null,
            first_name: "Lee",
            last_name: "Ann",
            email: "x@y.com",
          }),
        ],
      ]);
      const result = await topCustomers.execute(
        { range: "all", by: "spend", limit: 5 },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.rows[0][1]).toBe("Lee Ann");
    });

    it("falls back to email when name + first/last all blank", async () => {
      const mock = makeMockPool([
        [
          rawRow({
            name: null,
            first_name: null,
            last_name: null,
            email: "kyle@example.com",
          }),
        ],
      ]);
      const result = await topCustomers.execute(
        { range: "all", by: "spend", limit: 5 },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.rows[0][1]).toBe("kyle@example.com");
    });

    it("falls back to '0xabcd…wxyz' short address when no other identity", async () => {
      const mock = makeMockPool([
        [
          rawRow({
            customer_address: "0xaaaa1111bbbb2222cccc3333dddd4444eeee5555",
            name: null,
            first_name: null,
            last_name: null,
            email: null,
          }),
        ],
      ]);
      const result = await topCustomers.execute(
        { range: "all", by: "spend", limit: 5 },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.rows[0][1]).toBe("0xaaaa…5555");
    });
  });

  describe("SQL structural guards", () => {
    it("LEFT JOINs customers on address (for spend/order_count modes)", async () => {
      const mock = makeMockPool([[rawRow()]]);
      await topCustomers.execute(
        { range: "all", by: "spend", limit: 5 },
        ctx("peanut", mock)
      );
      expect(mock.captured[0].sql).toMatch(
        /LEFT JOIN customers c ON c\.address = o\.customer_address/
      );
    });

    it("shop-scoping: shop_id = $1 with ctx.shopId as first param", async () => {
      const mock = makeMockPool([[rawRow()]]);
      await topCustomers.execute(
        { range: "all", by: "spend", limit: 5 },
        ctx("shop-zzz", mock)
      );
      expect(mock.captured[0].sql).toMatch(/o\.shop_id = \$1/);
      expect(mock.captured[0].params[0]).toBe("shop-zzz");
    });

    it("limit param appears as the LAST positional param", async () => {
      const mock = makeMockPool([[rawRow()]]);
      await topCustomers.execute(
        { range: "all", by: "spend", limit: 7 },
        ctx("peanut", mock)
      );
      const params = mock.captured[0].params;
      expect(params[params.length - 1]).toBe(7);
    });
  });

  describe("args validation", () => {
    it("throws on invalid by", async () => {
      const mock = makeMockPool([]);
      await expect(
        topCustomers.execute(
          { range: "all", by: "popularity", limit: 5 },
          ctx("peanut", mock)
        )
      ).rejects.toThrow(/invalid by/);
    });

    it("throws on limit out of range", async () => {
      const mock = makeMockPool([]);
      await expect(
        topCustomers.execute(
          { range: "all", by: "spend", limit: 0 },
          ctx("peanut", mock)
        )
      ).rejects.toThrow(/integer 1\.\.10/);

      await expect(
        topCustomers.execute(
          { range: "all", by: "spend", limit: 11 },
          ctx("peanut", mock)
        )
      ).rejects.toThrow(/integer 1\.\.10/);
    });
  });
});
