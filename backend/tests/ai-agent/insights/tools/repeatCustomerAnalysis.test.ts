// backend/tests/ai-agent/insights/tools/repeatCustomerAnalysis.test.ts

import { repeatCustomerAnalysis } from "../../../../src/domains/AIAgentDomain/services/insights/tools/repeatCustomerAnalysis";
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

describe("repeat_customer_analysis tool", () => {
  it("returns newCount + repeatCount + pctRepeat + avgRepeatOrders", async () => {
    const mock = makeMockPool([
      [
        {
          new_count: "10",
          repeat_count: "5",
          avg_repeat_orders: "3.4",
        },
      ],
    ]);
    const r = await repeatCustomerAnalysis.execute(
      { range: "30d" },
      ctx("peanut", mock)
    );
    const data = r.data as {
      newCount: number;
      repeatCount: number;
      total: number;
      pctRepeat: number;
      avgRepeatOrders: number;
    };
    expect(data.newCount).toBe(10);
    expect(data.repeatCount).toBe(5);
    expect(data.total).toBe(15);
    expect(data.pctRepeat).toBeCloseTo(33.33, 1);
    expect(data.avgRepeatOrders).toBeCloseTo(3.4, 1);
  });

  it("pctRepeat = null when total = 0 (no divide-by-zero)", async () => {
    const mock = makeMockPool([
      [
        {
          new_count: "0",
          repeat_count: "0",
          avg_repeat_orders: null,
        },
      ],
    ]);
    const r = await repeatCustomerAnalysis.execute(
      { range: "7d" },
      ctx("peanut", mock)
    );
    expect((r.data as { pctRepeat: number | null }).pctRepeat).toBeNull();
    const display = r.display as Extract<typeof r.display, { kind: "number" }>;
    expect(display.primary).toBe("n/a");
    expect(display.sub).toMatch(/No paid\+completed bookings/);
  });

  it("display is a number with the repeat % as primary", async () => {
    const mock = makeMockPool([
      [
        {
          new_count: "10",
          repeat_count: "10",
          avg_repeat_orders: "2.5",
        },
      ],
    ]);
    const r = await repeatCustomerAnalysis.execute(
      { range: "30d" },
      ctx("peanut", mock)
    );
    const display = r.display as Extract<typeof r.display, { kind: "number" }>;
    expect(display.kind).toBe("number");
    expect(display.primary).toBe("50.0%");
    expect(display.label).toMatch(/Repeat-customer rate/);
    expect(display.sub).toMatch(/10 repeat \/ 10 new/);
    expect(display.sub).toMatch(/avg 2\.5 bookings/);
  });

  it("SQL uses CTE + FILTER(WHERE n) for new/repeat split, shop-scopes", async () => {
    const mock = makeMockPool([
      [{ new_count: "0", repeat_count: "0", avg_repeat_orders: null }],
    ]);
    await repeatCustomerAnalysis.execute(
      { range: "30d" },
      ctx("shop-q", mock)
    );
    expect(mock.captured[0].sql).toMatch(/WITH customer_orders AS/);
    expect(mock.captured[0].sql).toMatch(/FILTER \(WHERE n = 1\)/);
    expect(mock.captured[0].sql).toMatch(/FILTER \(WHERE n >= 2\)/);
    expect(mock.captured[0].sql).toMatch(/status IN \(\s*'paid'\s*,\s*'completed'\s*\)/);
    expect(mock.captured[0].sql).toMatch(/shop_id = \$1/);
    expect(mock.captured[0].params[0]).toBe("shop-q");
  });

  it("throws on invalid range", async () => {
    const mock = makeMockPool([]);
    await expect(
      repeatCustomerAnalysis.execute({ range: "yearly" }, ctx("peanut", mock))
    ).rejects.toThrow(/invalid range/);
  });
});
