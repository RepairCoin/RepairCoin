// backend/tests/ai-agent/insights/tools/timeOfDayPattern.test.ts

import { timeOfDayPattern } from "../../../../src/domains/AIAgentDomain/services/insights/tools/timeOfDayPattern";
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

describe("time_of_day_pattern tool", () => {
  it("returns a 24-bucket countsByHour array (zero-filled for absent hours)", async () => {
    const mock = makeMockPool([
      [
        { hour: "9", n: "5" },
        { hour: "14", n: "3" },
        { hour: "20", n: "1" },
      ],
    ]);
    const r = await timeOfDayPattern.execute(
      { range: "30d" },
      ctx("peanut", mock)
    );
    const data = r.data as {
      countsByHour: number[];
      total: number;
      peakHour: number;
      peakCount: number;
    };
    expect(data.countsByHour).toHaveLength(24);
    expect(data.countsByHour[9]).toBe(5);
    expect(data.countsByHour[14]).toBe(3);
    expect(data.countsByHour[20]).toBe(1);
    expect(data.countsByHour[0]).toBe(0); // zero-filled
    expect(data.total).toBe(9);
  });

  it("identifies peakHour by max count, ties broken by earliest hour", async () => {
    const mock = makeMockPool([
      [
        { hour: "9", n: "5" },
        { hour: "10", n: "5" }, // tie
        { hour: "14", n: "2" },
      ],
    ]);
    const r = await timeOfDayPattern.execute(
      { range: "all" },
      ctx("peanut", mock)
    );
    const data = r.data as { peakHour: number; peakCount: number };
    expect(data.peakHour).toBe(9); // earliest tied hour
    expect(data.peakCount).toBe(5);
  });

  it("display.kind=sparkline with 24-point series", async () => {
    const mock = makeMockPool([[{ hour: "9", n: "5" }]]);
    const r = await timeOfDayPattern.execute(
      { range: "7d" },
      ctx("peanut", mock)
    );
    const display = r.display as Extract<typeof r.display, { kind: "sparkline" }>;
    expect(display.kind).toBe("sparkline");
    expect(display.series).toHaveLength(24);
    expect(display.label).toMatch(/Bookings by hour/);
  });

  it("primary shows peak hour with am/pm formatting", async () => {
    const mock = makeMockPool([
      [
        { hour: "9", n: "5" },
        { hour: "20", n: "10" },
      ],
    ]);
    const r = await timeOfDayPattern.execute(
      { range: "30d" },
      ctx("peanut", mock)
    );
    const display = r.display as Extract<typeof r.display, { kind: "sparkline" }>;
    expect(display.primary).toBe("peak 8pm (10)"); // 20 → 8pm
  });

  it("primary says 'no bookings' when window is empty", async () => {
    const mock = makeMockPool([[]]);
    const r = await timeOfDayPattern.execute(
      { range: "7d" },
      ctx("peanut", mock)
    );
    const display = r.display as Extract<typeof r.display, { kind: "sparkline" }>;
    expect(display.primary).toBe("no bookings");
  });

  it("SQL uses EXTRACT(HOUR) on COALESCE(booking_date, created_at), shop-scopes", async () => {
    const mock = makeMockPool([[]]);
    await timeOfDayPattern.execute({ range: "30d" }, ctx("shop-x", mock));
    expect(mock.captured[0].sql).toMatch(
      /EXTRACT\(HOUR FROM COALESCE\(booking_date, created_at\)\)/
    );
    expect(mock.captured[0].sql).toMatch(/shop_id = \$1/);
    expect(mock.captured[0].params[0]).toBe("shop-x");
  });

  it("ignores hour values outside 0..23 (defensive)", async () => {
    const mock = makeMockPool([
      [
        { hour: "9", n: "5" },
        { hour: "99", n: "1" }, // bogus
        { hour: "-1", n: "1" }, // bogus
      ],
    ]);
    const r = await timeOfDayPattern.execute(
      { range: "30d" },
      ctx("peanut", mock)
    );
    const data = r.data as { total: number; countsByHour: number[] };
    // 5 was counted, the two bogus values dropped silently.
    expect(data.total).toBe(5);
    expect(data.countsByHour.every((c, i) => i === 9 ? c === 5 : c === 0)).toBe(true);
  });

  it("throws on invalid range", async () => {
    const mock = makeMockPool([]);
    await expect(
      timeOfDayPattern.execute({ range: "yearly" }, ctx("peanut", mock))
    ).rejects.toThrow(/invalid range/);
  });
});
