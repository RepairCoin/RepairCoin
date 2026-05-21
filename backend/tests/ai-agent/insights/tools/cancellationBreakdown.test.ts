// backend/tests/ai-agent/insights/tools/cancellationBreakdown.test.ts

import { cancellationBreakdown } from "../../../../src/domains/AIAgentDomain/services/insights/tools/cancellationBreakdown";
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

describe("cancellation_breakdown tool", () => {
  it("rolls up by 3 canonical statuses + zero-fills absent ones", async () => {
    const mock = makeMockPool([
      [
        { status: "cancelled", cancellation_reason: "schedule conflict", n: "5" },
        { status: "cancelled", cancellation_reason: null, n: "3" },
        { status: "no_show", cancellation_reason: null, n: "2" },
      ],
    ]);
    const r = await cancellationBreakdown.execute(
      { range: "30d" },
      ctx("peanut", mock)
    );
    const data = r.data as { total: number; byStatus: Record<string, number> };
    expect(data.total).toBe(10);
    expect(data.byStatus.cancelled).toBe(8);
    expect(data.byStatus.no_show).toBe(2);
    expect(data.byStatus.expired).toBe(0); // canonical zero-fill
  });

  it("surfaces topReasons sorted by count desc, max 3", async () => {
    const mock = makeMockPool([
      [
        { status: "cancelled", cancellation_reason: "schedule conflict", n: "5" },
        { status: "cancelled", cancellation_reason: "found another shop", n: "3" },
        { status: "cancelled", cancellation_reason: "price", n: "2" },
        { status: "cancelled", cancellation_reason: "rude staff", n: "1" },
      ],
    ]);
    const r = await cancellationBreakdown.execute(
      { range: "all" },
      ctx("peanut", mock)
    );
    const data = r.data as {
      topReasons: Array<{ reason: string; count: number }>;
    };
    expect(data.topReasons).toHaveLength(3);
    expect(data.topReasons[0]).toEqual({ reason: "schedule conflict", count: 5 });
    expect(data.topReasons[2]).toEqual({ reason: "price", count: 2 });
  });

  it("display.items[0] is Total lost", async () => {
    const mock = makeMockPool([
      [{ status: "cancelled", cancellation_reason: null, n: "10" }],
    ]);
    const r = await cancellationBreakdown.execute(
      { range: "7d" },
      ctx("peanut", mock)
    );
    const display = r.display as Extract<typeof r.display, { kind: "list" }>;
    expect(display.items[0]).toEqual({ label: "Total lost", value: "10" });
  });

  it("topReasons rendered as '↳ <reason>' rows in display", async () => {
    const mock = makeMockPool([
      [
        { status: "cancelled", cancellation_reason: "schedule conflict", n: "5" },
      ],
    ]);
    const r = await cancellationBreakdown.execute(
      { range: "30d" },
      ctx("peanut", mock)
    );
    const display = r.display as Extract<typeof r.display, { kind: "list" }>;
    const reasonRow = display.items.find((i) => i.label.startsWith("↳ "));
    expect(reasonRow?.label).toBe("↳ schedule conflict");
    expect(reasonRow?.value).toBe("5");
  });

  it("SQL filters status IN ('cancelled','no_show','expired') and shop-scopes", async () => {
    const mock = makeMockPool([[]]);
    await cancellationBreakdown.execute(
      { range: "30d" },
      ctx("shop-z", mock)
    );
    expect(mock.captured[0].sql).toMatch(
      /status IN \(\s*'cancelled'\s*,\s*'no_show'\s*,\s*'expired'\s*\)/
    );
    expect(mock.captured[0].sql).toMatch(/shop_id = \$1/);
    expect(mock.captured[0].params[0]).toBe("shop-z");
  });

  it("throws on invalid range", async () => {
    const mock = makeMockPool([]);
    await expect(
      cancellationBreakdown.execute({ range: "yearly" }, ctx("peanut", mock))
    ).rejects.toThrow(/invalid range/);
  });
});
