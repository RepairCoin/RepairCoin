// backend/tests/ai-agent/insights/tools/topServices.test.ts

import { topServices } from "../../../../src/domains/AIAgentDomain/services/insights/tools/topServices";
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

describe("top_services tool", () => {
  describe("by='revenue'", () => {
    it("returns table display with Revenue column + USD formatting", async () => {
      const mock = makeMockPool([
        [
          {
            service_id: "srv_1",
            service_name: "AQua Tech",
            total: "5895.04",
            n: "13",
          },
          {
            service_id: "srv_2",
            service_name: "I Robot",
            total: "1399.98",
            n: "2",
          },
        ],
      ]);
      const result = await topServices.execute(
        { range: "all", by: "revenue", limit: 5 },
        ctx("peanut", mock)
      );

      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.columns).toEqual(["#", "Service", "Revenue"]);
      expect(display.rows[0]).toEqual([1, "AQua Tech", "$5,895.04"]);
      expect(display.rows[1]).toEqual([2, "I Robot", "$1,399.98"]);
    });

    it("SQL filters status IN ('paid', 'completed')", async () => {
      const mock = makeMockPool([[]]);
      await topServices.execute(
        { range: "all", by: "revenue", limit: 5 },
        ctx("peanut", mock)
      );
      expect(mock.captured[0].sql).toMatch(
        /status IN \(\s*'paid'\s*,\s*'completed'\s*\)/
      );
    });
  });

  describe("by='bookings'", () => {
    it("counts ALL statuses (intent-to-book view)", async () => {
      const mock = makeMockPool([
        [
          { service_id: "srv_1", service_name: "AQua Tech", n: "40" },
          { service_id: "srv_2", service_name: "S Tripe Hair Cut", n: "21" },
        ],
      ]);
      const result = await topServices.execute(
        { range: "all", by: "bookings", limit: 5 },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.columns[2]).toBe("Bookings");
      expect(display.rows[0][2]).toBe("40");
    });

    it("SQL has NO status filter (bookings counts all)", async () => {
      const mock = makeMockPool([[]]);
      await topServices.execute(
        { range: "all", by: "bookings", limit: 5 },
        ctx("peanut", mock)
      );
      // Bookings SQL should not filter by status.
      expect(mock.captured[0].sql).not.toMatch(/status IN/);
    });
  });

  describe("by='conversion'", () => {
    it("uses two CTEs + INNER JOIN on conversations (excludes 0-conv services)", async () => {
      const mock = makeMockPool([
        [
          {
            service_id: "srv_1",
            service_name: "AQua Tech",
            paid_n: "13",
            conv_n: "1",
          },
        ],
      ]);
      const result = await topServices.execute(
        { range: "all", by: "conversion", limit: 5 },
        ctx("peanut", mock)
      );

      const data = result.data as {
        services: Array<{
          paidBookings: number;
          conversations: number;
          value: number;
        }>;
      };
      expect(data.services[0].paidBookings).toBe(13);
      expect(data.services[0].conversations).toBe(1);
      expect(data.services[0].value).toBe(13); // 13/1
      expect(mock.captured[0].sql).toMatch(/WITH orders AS/);
      expect(mock.captured[0].sql).toMatch(/INNER JOIN convos/);
    });

    it("formats conversion as 'X.X% (paid/conv)' so the eye sees both counts", async () => {
      const mock = makeMockPool([
        [
          {
            service_id: "srv_1",
            service_name: "AQua Tech",
            paid_n: "13",
            conv_n: "1",
          },
        ],
      ]);
      const result = await topServices.execute(
        { range: "all", by: "conversion", limit: 5 },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.columns[2]).toBe("Conversion");
      expect(display.rows[0][2]).toBe("1300.0% (13/1)");
    });
  });

  describe("deleted-service fallback", () => {
    it("renders '(deleted service ...)' when JOIN returns NULL service_name", async () => {
      const mock = makeMockPool([
        [
          {
            service_id: "srv_deleted_xyz_999",
            service_name: null,
            total: "100.00",
            n: "1",
          },
        ],
      ]);
      const result = await topServices.execute(
        { range: "all", by: "revenue", limit: 5 },
        ctx("peanut", mock)
      );
      const display = result.display as Extract<typeof result.display, { kind: "table" }>;
      expect(display.rows[0][1]).toMatch(/^\(deleted service srv_deleted/);
    });
  });

  describe("SQL structural guards", () => {
    it("revenue mode shop-scopes via o.shop_id = $1", async () => {
      const mock = makeMockPool([[]]);
      await topServices.execute(
        { range: "all", by: "revenue", limit: 5 },
        ctx("shop-abc", mock)
      );
      expect(mock.captured[0].sql).toMatch(/o\.shop_id = \$1/);
      expect(mock.captured[0].params[0]).toBe("shop-abc");
    });

    it("conversion CTE shop-scopes BOTH orders and convos sides", async () => {
      const mock = makeMockPool([[]]);
      await topServices.execute(
        { range: "all", by: "conversion", limit: 5 },
        ctx("shop-abc", mock)
      );
      // Both CTEs and the outer select use $1 = shopId.
      const sql = mock.captured[0].sql;
      expect(sql).toMatch(/o\.shop_id = \$1/);
      expect(sql).toMatch(/c\.shop_id = \$1/);
      expect(sql).toMatch(/s\.shop_id = \$1/);
    });
  });

  describe("args validation", () => {
    it("throws on invalid by", async () => {
      const mock = makeMockPool([]);
      await expect(
        topServices.execute(
          { range: "all", by: "profit", limit: 5 },
          ctx("peanut", mock)
        )
      ).rejects.toThrow(/invalid by/);
    });

    it("throws on limit > 10", async () => {
      const mock = makeMockPool([]);
      await expect(
        topServices.execute(
          { range: "all", by: "revenue", limit: 11 },
          ctx("peanut", mock)
        )
      ).rejects.toThrow(/integer 1\.\.10/);
    });
  });
});
