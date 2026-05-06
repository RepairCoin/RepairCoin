// backend/tests/ai-agent/SpendCapEnforcer.test.ts
//
// Tests the spend cap pre-flight check + recordSpend increment + month rollover.
// Mocks the pg Pool so no DB hits.

import { SpendCapEnforcer } from "../../src/domains/AIAgentDomain/services/SpendCapEnforcer";

function mockPool(rows: any[] = []) {
  const queryMock = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes("SELECT monthly_budget_usd")) {
      return Promise.resolve({ rows });
    }
    // UPDATE statements (recordSpend, maybeRolloverMonth)
    return Promise.resolve({ rowCount: rows.length });
  });
  return { query: queryMock } as any;
}

describe("SpendCapEnforcer.canSpend", () => {
  it("returns no_shop_settings when shop has no row", async () => {
    const enforcer = new SpendCapEnforcer(mockPool([]));
    const result = await enforcer.canSpend("missing_shop");
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toBe("no_shop_settings");
    expect(result.useCheaperModel).toBe(false);
  });

  it("allows + uses Sonnet when spend < 70% of budget", async () => {
    const enforcer = new SpendCapEnforcer(
      mockPool([{ monthly_budget_usd: "20.00", current_month_spend_usd: "5.00" }])
    );
    const result = await enforcer.canSpend("shop_a");
    expect(result.allowed).toBe(true);
    expect(result.useCheaperModel).toBe(false);
    expect(result.percentUsed).toBeCloseTo(0.25, 2);
  });

  it("allows + switches to Haiku at exactly 70% of budget", async () => {
    const enforcer = new SpendCapEnforcer(
      mockPool([{ monthly_budget_usd: "20.00", current_month_spend_usd: "14.00" }])
    );
    const result = await enforcer.canSpend("shop_b");
    expect(result.allowed).toBe(true);
    expect(result.useCheaperModel).toBe(true);
    expect(result.percentUsed).toBeCloseTo(0.7, 2);
  });

  it("allows + switches to Haiku above 70% (e.g., 85%)", async () => {
    const enforcer = new SpendCapEnforcer(
      mockPool([{ monthly_budget_usd: "20.00", current_month_spend_usd: "17.00" }])
    );
    const result = await enforcer.canSpend("shop_c");
    expect(result.allowed).toBe(true);
    expect(result.useCheaperModel).toBe(true);
  });

  it("blocks at exactly 100% of budget", async () => {
    const enforcer = new SpendCapEnforcer(
      mockPool([{ monthly_budget_usd: "20.00", current_month_spend_usd: "20.00" }])
    );
    const result = await enforcer.canSpend("shop_d");
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toBe("monthly_budget_exceeded");
  });

  it("blocks when over budget", async () => {
    const enforcer = new SpendCapEnforcer(
      mockPool([{ monthly_budget_usd: "20.00", current_month_spend_usd: "25.50" }])
    );
    const result = await enforcer.canSpend("shop_e");
    expect(result.allowed).toBe(false);
  });
});

describe("SpendCapEnforcer.recordSpend", () => {
  it("issues an UPDATE with the cost amount", async () => {
    const pool = mockPool([{ monthly_budget_usd: "20.00", current_month_spend_usd: "5.00" }]);
    const enforcer = new SpendCapEnforcer(pool);
    await enforcer.recordSpend("shop_a", 0.0234);

    // Look for an UPDATE call (not the SELECT or rollover)
    const updateCall = pool.query.mock.calls.find((c: any) =>
      c[0].includes("UPDATE ai_shop_settings") &&
      c[0].includes("current_month_spend_usd = current_month_spend_usd +")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toEqual([0.0234, "shop_a"]);
  });

  it("does not issue an UPDATE for cost <= 0", async () => {
    const pool = mockPool([]);
    const enforcer = new SpendCapEnforcer(pool);
    await enforcer.recordSpend("shop_x", 0);
    await enforcer.recordSpend("shop_x", -0.5);

    // No update issued
    const updateCalls = pool.query.mock.calls.filter((c: any) =>
      c[0].includes("UPDATE ai_shop_settings") &&
      c[0].includes("current_month_spend_usd +")
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("swallows DB errors gracefully (returns void)", async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 0 }) // maybeRolloverMonth (called inside canSpend, but we're calling recordSpend here)
        .mockRejectedValueOnce(new Error("connection lost")),
    } as any;
    const enforcer = new SpendCapEnforcer(pool);
    await expect(enforcer.recordSpend("shop_x", 1.5)).resolves.toBeUndefined();
  });
});
