// backend/tests/ai-agent/insights/tools/rcnBalanceSummary.test.ts

import { rcnBalanceSummary } from "../../../../src/domains/AIAgentDomain/services/insights/tools/rcnBalanceSummary";
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

describe("rcn_balance_summary tool", () => {
  it("returns availableRcn + lifetimeIssued + monthlyBurn + runwayMonths", async () => {
    const mock = makeMockPool([
      [{ purchased_rcn_balance: "1000", total_tokens_issued: "500" }],
      [{ burn: "100" }],
    ]);
    const r = await rcnBalanceSummary.execute({}, ctx("peanut", mock));
    const data = r.data as {
      availableRcn: number;
      lifetimeIssued: number;
      monthlyBurn: number;
      runwayMonths: number | null;
    };
    expect(data.availableRcn).toBe(1000);
    expect(data.lifetimeIssued).toBe(500);
    expect(data.monthlyBurn).toBe(100);
    expect(data.runwayMonths).toBe(10);
  });

  it("runwayMonths = null when monthlyBurn = 0 (no divide-by-zero)", async () => {
    const mock = makeMockPool([
      [{ purchased_rcn_balance: "500", total_tokens_issued: "0" }],
      [{ burn: "0" }],
    ]);
    const r = await rcnBalanceSummary.execute({}, ctx("peanut", mock));
    expect((r.data as { runwayMonths: number | null }).runwayMonths).toBeNull();
    const display = r.display as Extract<typeof r.display, { kind: "list" }>;
    const runwayItem = display.items.find((i) =>
      i.label.includes("Runway")
    );
    expect(runwayItem?.value).toBe("n/a (no burn)");
  });

  it("display lists all 4 fields in order: available / lifetime / burn / runway", async () => {
    const mock = makeMockPool([
      [{ purchased_rcn_balance: "1000", total_tokens_issued: "500" }],
      [{ burn: "100" }],
    ]);
    const r = await rcnBalanceSummary.execute({}, ctx("peanut", mock));
    const display = r.display as Extract<typeof r.display, { kind: "list" }>;
    const labels = display.items.map((i) => i.label);
    expect(labels).toEqual([
      "Available balance",
      "Lifetime issued",
      "Issued in last 30 days",
      "Runway at current burn",
    ]);
  });

  it("handles NULL shop balance gracefully (defaults to 0)", async () => {
    const mock = makeMockPool([
      [{ purchased_rcn_balance: null, total_tokens_issued: null }],
      [{ burn: "0" }],
    ]);
    const r = await rcnBalanceSummary.execute({}, ctx("peanut", mock));
    expect((r.data as { availableRcn: number }).availableRcn).toBe(0);
    expect((r.data as { lifetimeIssued: number }).lifetimeIssued).toBe(0);
  });

  it("first query reads shops.purchased_rcn_balance + total_tokens_issued", async () => {
    const mock = makeMockPool([
      [{ purchased_rcn_balance: "0", total_tokens_issued: "0" }],
      [{ burn: "0" }],
    ]);
    await rcnBalanceSummary.execute({}, ctx("shop-abc", mock));
    expect(mock.captured[0].sql).toMatch(/FROM shops/);
    expect(mock.captured[0].sql).toMatch(/purchased_rcn_balance/);
    expect(mock.captured[0].sql).toMatch(/total_tokens_issued/);
    expect(mock.captured[0].params[0]).toBe("shop-abc");
  });

  it("second query reads transactions with type IN ('mint','tier_bonus') and last-30-day window", async () => {
    const mock = makeMockPool([
      [{ purchased_rcn_balance: "0", total_tokens_issued: "0" }],
      [{ burn: "0" }],
    ]);
    await rcnBalanceSummary.execute({}, ctx("shop-abc", mock));
    expect(mock.captured[1].sql).toMatch(/FROM transactions/);
    expect(mock.captured[1].sql).toMatch(
      /type IN \(\s*'mint'\s*,\s*'tier_bonus'\s*\)/
    );
    expect(mock.captured[1].sql).toMatch(/created_at >= \$2/);
    expect(mock.captured[1].params[0]).toBe("shop-abc");
    expect(mock.captured[1].params[1]).toBeInstanceOf(Date);
  });
});
