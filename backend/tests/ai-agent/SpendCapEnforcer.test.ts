// backend/tests/ai-agent/SpendCapEnforcer.test.ts
//
// Spend cap: the monthly budget is a PURE FUNCTION of the shop's tier ($10/$30/$75), computed via
// getShopTier (mocked here); 70% → Haiku; 100% → SOFT LANDING (still allowed, limitReached + Haiku),
// never a hard block. recordSpend increment unchanged. Mocks the pg Pool + getShopTier so no DB hits.

jest.mock("../../src/utils/shopTier", () => ({ getShopTier: jest.fn() }));

import { SpendCapEnforcer } from "../../src/domains/AIAgentDomain/services/SpendCapEnforcer";
import { getShopTier } from "../../src/utils/shopTier";

const mockedGetShopTier = getShopTier as jest.Mock;

function mockPool(rows: any[] = []) {
  const queryMock = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes("SELECT current_month_spend_usd")) return Promise.resolve({ rows });
    return Promise.resolve({ rowCount: rows.length }); // UPDATE / INSERT (rollover, provision, recordSpend)
  });
  return { query: queryMock } as any;
}

const spend = (v: string) => [{ current_month_spend_usd: v }];

beforeEach(() => mockedGetShopTier.mockResolvedValue("growth")); // $30 default; override per test

describe("SpendCapEnforcer.canSpend — budget follows the tier", () => {
  it.each([
    ["starter", 10],
    ["growth", 30],
    ["business", 75],
  ])("budget for %s = $%d (computed from the tier, not a stored value)", async (tier, budget) => {
    mockedGetShopTier.mockResolvedValueOnce(tier);
    const enforcer = new SpendCapEnforcer(mockPool(spend("0.00")));
    const r = await enforcer.canSpend("shop");
    expect(r.monthlyBudgetUsd).toBe(budget);
    expect(r.allowed).toBe(true);
  });

  it("fails closed to starter/$10 when tier resolution errors", async () => {
    mockedGetShopTier.mockRejectedValueOnce(new Error("db down"));
    const enforcer = new SpendCapEnforcer(mockPool(spend("0.00")));
    expect((await enforcer.canSpend("shop")).monthlyBudgetUsd).toBe(10);
  });

  it("allows against the tier budget when the shop has no settings row (lazy-provisions)", async () => {
    mockedGetShopTier.mockResolvedValueOnce("business");
    const enforcer = new SpendCapEnforcer(mockPool([]));
    const r = await enforcer.canSpend("missing_shop");
    expect(r.allowed).toBe(true);
    expect(r.useCheaperModel).toBe(false);
    expect(r.monthlyBudgetUsd).toBe(75);
    expect(r.currentSpendUsd).toBe(0);
  });
});

describe("SpendCapEnforcer.canSpend — thresholds", () => {
  it("Sonnet below 70% (growth $30, spent $9 = 30%)", async () => {
    const r = await new SpendCapEnforcer(mockPool(spend("9.00"))).canSpend("s");
    expect(r.allowed).toBe(true);
    expect(r.useCheaperModel).toBe(false);
    expect(r.limitReached).toBeFalsy();
  });

  it("switches to Haiku at exactly 70% (growth $30, spent $21)", async () => {
    const r = await new SpendCapEnforcer(mockPool(spend("21.00"))).canSpend("s");
    expect(r.useCheaperModel).toBe(true);
    expect(r.limitReached).toBeFalsy();
  });

  it("SOFT LANDING at 100% — still allowed, Haiku-only, limitReached (no hard block)", async () => {
    const r = await new SpendCapEnforcer(mockPool(spend("30.00"))).canSpend("s");
    expect(r.allowed).toBe(true);
    expect(r.useCheaperModel).toBe(true);
    expect(r.limitReached).toBe(true);
  });

  it("SOFT LANDING when over budget too (spent $40 on $30)", async () => {
    const r = await new SpendCapEnforcer(mockPool(spend("40.00"))).canSpend("s");
    expect(r.allowed).toBe(true);
    expect(r.limitReached).toBe(true);
  });
});

describe("SpendCapEnforcer.canSpend — AI Usage Overage (T3.2)", () => {
  const ORIG = process.env.ENABLE_AI_OVERAGE;
  afterEach(() => { process.env.ENABLE_AI_OVERAGE = ORIG; });

  // rows carry both spend + the overage opt-in flag
  const row = (v: string, overage: boolean) => [{ current_month_spend_usd: v, ai_overage_enabled: overage }];

  it("keeps the FULL model past the cap when overage is enabled AND the flag is on (no nag)", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const r = await new SpendCapEnforcer(mockPool(row("40.00", true))).canSpend("s"); // $40 on $30
    expect(r.allowed).toBe(true);
    expect(r.useCheaperModel).toBe(false); // NOT degraded
    expect(r.overageEnabled).toBe(true);
    expect(r.limitReached).toBe(false); // limit no longer actionable → banner suppressed
  });

  it("still soft-lands to Haiku when the shop has NOT opted into overage (flag on)", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const r = await new SpendCapEnforcer(mockPool(row("40.00", false))).canSpend("s");
    expect(r.useCheaperModel).toBe(true);
    expect(r.limitReached).toBe(true);
    expect(r.overageEnabled).toBe(false);
  });

  it("ignores the opt-in when the master flag is OFF (soft-lands to Haiku)", async () => {
    process.env.ENABLE_AI_OVERAGE = "false";
    const r = await new SpendCapEnforcer(mockPool(row("40.00", true))).canSpend("s");
    expect(r.useCheaperModel).toBe(true);
    expect(r.overageEnabled).toBe(false);
  });

  it("does nothing below the cap even with overage on", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const r = await new SpendCapEnforcer(mockPool(row("9.00", true))).canSpend("s"); // 30%
    expect(r.limitReached).toBeFalsy();
    expect(r.useCheaperModel).toBe(false);
  });
});

describe("SpendCapEnforcer.canSpend — overage bill-shock guardrail (T3.2 Slice 2.5)", () => {
  const ORIG_FLAG = process.env.ENABLE_AI_OVERAGE;
  const ORIG_CAP = process.env.AI_OVERAGE_MONTHLY_CAP_USD;
  beforeEach(() => { process.env.ENABLE_AI_OVERAGE = "true"; });
  afterEach(() => { process.env.ENABLE_AI_OVERAGE = ORIG_FLAG; process.env.AI_OVERAGE_MONTHLY_CAP_USD = ORIG_CAP; });

  const row = (v: string, overage: boolean) => [{ current_month_spend_usd: v, ai_overage_enabled: overage }];

  it("reverts to Haiku once the billable overage reaches the cap (growth $30, spent $40 → $30 billable ≥ $5 cap)", async () => {
    process.env.AI_OVERAGE_MONTHLY_CAP_USD = "5";
    const r = await new SpendCapEnforcer(mockPool(row("40.00", true))).canSpend("s");
    expect(r.useCheaperModel).toBe(true); // guardrail → degraded
    expect(r.overageCapReached).toBe(true);
    expect(r.limitReached).toBe(true);
  });

  it("keeps the full model while under the cap ($40 → $30 billable < $100 default)", async () => {
    delete process.env.AI_OVERAGE_MONTHLY_CAP_USD; // default 100
    const r = await new SpendCapEnforcer(mockPool(row("40.00", true))).canSpend("s");
    expect(r.useCheaperModel).toBe(false);
    expect(r.overageCapReached).toBeFalsy();
  });

  it("treats cap=0 as unlimited (huge spend still full model)", async () => {
    process.env.AI_OVERAGE_MONTHLY_CAP_USD = "0";
    const r = await new SpendCapEnforcer(mockPool(row("1000.00", true))).canSpend("s");
    expect(r.useCheaperModel).toBe(false);
    expect(r.overageCapReached).toBeFalsy();
  });
});

describe("SpendCapEnforcer.canSpend — per-shop overage cap (T3.2)", () => {
  const ORIG_FLAG = process.env.ENABLE_AI_OVERAGE;
  const ORIG_CAP = process.env.AI_OVERAGE_MONTHLY_CAP_USD;
  beforeEach(() => { process.env.ENABLE_AI_OVERAGE = "true"; });
  afterEach(() => { process.env.ENABLE_AI_OVERAGE = ORIG_FLAG; process.env.AI_OVERAGE_MONTHLY_CAP_USD = ORIG_CAP; });

  // row carries spend + opt-in + the per-shop cap column
  const row = (v: string, overage: boolean, cap: string | null) =>
    [{ current_month_spend_usd: v, ai_overage_enabled: overage, overage_cap_usd: cap }];

  it("uses the shop's own cap over the platform default (per-shop $5 trips before the $100 default)", async () => {
    delete process.env.AI_OVERAGE_MONTHLY_CAP_USD; // default 100
    // growth $30, spent $40 → $30 billable ≥ $5 per-shop cap → guardrail trips
    const r = await new SpendCapEnforcer(mockPool(row("40.00", true, "5"))).canSpend("s");
    expect(r.useCheaperModel).toBe(true);
    expect(r.overageCapReached).toBe(true);
  });

  it("a HIGHER per-shop cap overrides a low platform default (per-shop $50 keeps full model)", async () => {
    process.env.AI_OVERAGE_MONTHLY_CAP_USD = "5"; // low platform default
    // $30 billable < $50 per-shop cap → full model despite the low global default
    const r = await new SpendCapEnforcer(mockPool(row("40.00", true, "50"))).canSpend("s");
    expect(r.useCheaperModel).toBe(false);
    expect(r.overageCapReached).toBeFalsy();
  });

  it("falls back to the platform default when the shop has no cap set (null)", async () => {
    process.env.AI_OVERAGE_MONTHLY_CAP_USD = "5";
    const r = await new SpendCapEnforcer(mockPool(row("40.00", true, null))).canSpend("s");
    expect(r.useCheaperModel).toBe(true); // inherits the $5 default → $30 billable trips it
    expect(r.overageCapReached).toBe(true);
  });
});

describe("SpendCapEnforcer.recordSpend — overage accrual (T3.2 Slice 2)", () => {
  const ORIG = process.env.ENABLE_AI_OVERAGE;
  beforeEach(() => { process.env.ENABLE_AI_OVERAGE = "true"; mockedGetShopTier.mockResolvedValue("growth"); }); // $30
  afterEach(() => { process.env.ENABLE_AI_OVERAGE = ORIG; });

  // UPDATE ... RETURNING returns the post-increment spend + the opt-in flag.
  const recordPool = (afterSpend: string, overage: boolean) =>
    ({ query: jest.fn().mockResolvedValue({ rows: [{ current_month_spend_usd: afterSpend, ai_overage_enabled: overage }] }) } as any);

  it("accrues only the slice of the increment that crossed the cap ($28→$33 on $30 → $3)", async () => {
    const accrue = jest.fn().mockResolvedValue(undefined);
    await new SpendCapEnforcer(recordPool("33.00", true), accrue).recordSpend("s", 5); // before $28
    expect(accrue).toHaveBeenCalledWith("s", 3);
  });

  it("accrues the whole cost when already over the cap ($35→$37 → $2)", async () => {
    const accrue = jest.fn().mockResolvedValue(undefined);
    await new SpendCapEnforcer(recordPool("37.00", true), accrue).recordSpend("s", 2);
    expect(accrue).toHaveBeenCalledWith("s", 2);
  });

  it("does not accrue when the increment stays under the cap ($10→$15 on $30)", async () => {
    const accrue = jest.fn().mockResolvedValue(undefined);
    await new SpendCapEnforcer(recordPool("15.00", true), accrue).recordSpend("s", 5);
    expect(accrue).not.toHaveBeenCalled();
  });

  it("does not accrue when the shop has NOT opted into overage", async () => {
    const accrue = jest.fn().mockResolvedValue(undefined);
    await new SpendCapEnforcer(recordPool("40.00", false), accrue).recordSpend("s", 5);
    expect(accrue).not.toHaveBeenCalled();
  });

  it("does not accrue when the master flag is OFF", async () => {
    process.env.ENABLE_AI_OVERAGE = "false";
    const accrue = jest.fn().mockResolvedValue(undefined);
    await new SpendCapEnforcer(recordPool("40.00", true), accrue).recordSpend("s", 5);
    expect(accrue).not.toHaveBeenCalled();
  });

  it("never lets an accrual failure break recordSpend", async () => {
    const accrue = jest.fn().mockRejectedValue(new Error("ledger down"));
    await expect(
      new SpendCapEnforcer(recordPool("40.00", true), accrue).recordSpend("s", 5)
    ).resolves.toBeUndefined();
  });
});

describe("SpendCapEnforcer.recordSpend", () => {
  it("issues an UPDATE with the cost amount", async () => {
    const pool = mockPool(spend("5.00"));
    await new SpendCapEnforcer(pool).recordSpend("shop_a", 0.0234);
    const updateCall = pool.query.mock.calls.find(
      (c: any) => c[0].includes("UPDATE ai_shop_settings") && c[0].includes("current_month_spend_usd = current_month_spend_usd +")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toEqual([0.0234, "shop_a"]);
  });

  it("does not issue an UPDATE for cost <= 0", async () => {
    const pool = mockPool([]);
    const enforcer = new SpendCapEnforcer(pool);
    await enforcer.recordSpend("shop_x", 0);
    await enforcer.recordSpend("shop_x", -0.5);
    const updates = pool.query.mock.calls.filter(
      (c: any) => c[0].includes("UPDATE ai_shop_settings") && c[0].includes("current_month_spend_usd +")
    );
    expect(updates).toHaveLength(0);
  });

  it("swallows DB errors gracefully", async () => {
    const pool = { query: jest.fn().mockRejectedValue(new Error("connection lost")) } as any;
    await expect(new SpendCapEnforcer(pool).recordSpend("shop_x", 1.5)).resolves.toBeUndefined();
  });
});
