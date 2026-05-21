// backend/tests/ai-agent/insights/tools/customerTierDistribution.test.ts

import { customerTierDistribution } from "../../../../src/domains/AIAgentDomain/services/insights/tools/customerTierDistribution";
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

describe("customer_tier_distribution tool", () => {
  it("returns canonical tiers (Bronze/Silver/Gold) even when DB has only some", async () => {
    const mock = makeMockPool([
      [
        { tier: "BRONZE", n: "20" },
        { tier: "GOLD", n: "3" },
      ],
    ]);
    const r = await customerTierDistribution.execute({}, ctx("peanut", mock));
    const data = r.data as { total: number; byTier: Record<string, number> };
    expect(data.total).toBe(23);
    expect(data.byTier.BRONZE).toBe(20);
    expect(data.byTier.SILVER).toBe(0); // canonical zero-fill
    expect(data.byTier.GOLD).toBe(3);
  });

  it("display.items[0] is Total customers", async () => {
    const mock = makeMockPool([[{ tier: "BRONZE", n: "10" }]]);
    const r = await customerTierDistribution.execute({}, ctx("peanut", mock));
    const display = r.display as Extract<typeof r.display, { kind: "list" }>;
    expect(display.items[0]).toEqual({ label: "Total customers", value: "10" });
  });

  it("formats present-count as 'N (X.X%)', zero-count as plain '0'", async () => {
    const mock = makeMockPool([
      [
        { tier: "BRONZE", n: "75" },
        { tier: "SILVER", n: "25" },
      ],
    ]);
    const r = await customerTierDistribution.execute({}, ctx("peanut", mock));
    const display = r.display as Extract<typeof r.display, { kind: "list" }>;
    const bronze = display.items.find((i) => i.label === "Bronze");
    const gold = display.items.find((i) => i.label === "Gold");
    expect(bronze?.value).toBe("75 (75.0%)");
    expect(gold?.value).toBe("0");
  });

  it("appends non-canonical tiers after the canonical block", async () => {
    const mock = makeMockPool([
      [
        { tier: "BRONZE", n: "5" },
        { tier: "PLATINUM", n: "2" }, // hypothetical future tier
      ],
    ]);
    const r = await customerTierDistribution.execute({}, ctx("peanut", mock));
    const display = r.display as Extract<typeof r.display, { kind: "list" }>;
    const labels = display.items.map((i) => i.label);
    // Total + 3 canonical = 4, then Platinum.
    expect(labels[4]).toBe("Platinum");
  });

  it("NULL tier value renders as 'Unknown'", async () => {
    const mock = makeMockPool([[{ tier: null, n: "1" }]]);
    const r = await customerTierDistribution.execute({}, ctx("peanut", mock));
    const display = r.display as Extract<typeof r.display, { kind: "list" }>;
    const labels = display.items.map((i) => i.label);
    expect(labels).toContain("Unknown");
  });

  it("SQL shop-scopes via service_orders JOIN", async () => {
    const mock = makeMockPool([[]]);
    await customerTierDistribution.execute({}, ctx("shop-xyz", mock));
    expect(mock.captured[0].sql).toMatch(
      /JOIN service_orders o ON o\.customer_address = c\.address/
    );
    expect(mock.captured[0].sql).toMatch(/o\.shop_id = \$1/);
    expect(mock.captured[0].params[0]).toBe("shop-xyz");
  });

  it("no args required (snapshot tool, no range)", async () => {
    expect(customerTierDistribution.inputSchema).toMatchObject({
      type: "object",
      properties: {},
      required: [],
    });
  });
});
