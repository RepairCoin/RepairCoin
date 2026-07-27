// backend/tests/ai-agent/SpendCapEnforcer.test.ts
//
// Spend cap: the monthly budget is a PURE FUNCTION of the shop's tier ($10/$30/$75), computed via
// getShopTier (mocked here); 70% → Haiku; 100% → SOFT LANDING (still allowed, limitReached + Haiku),
// never a hard block. recordSpend increment unchanged. Mocks the pg Pool + getShopTier so no DB hits.
//
// Since migration 240, canSpend DERIVES spend from the ai_usage_events view rather than reading the
// ai_shop_settings.current_month_spend_usd counter — so the mocked row carries `derived_spend_usd`
// and a `has_settings` flag. The query always returns exactly one row (it LEFT JOINs settings onto
// the requested shop_id), which is why "shop has no settings row" is has_settings:false, not [].

jest.mock("../../src/utils/shopTier", () => ({ getShopTier: jest.fn() }));

import { SpendCapEnforcer } from "../../src/domains/AIAgentDomain/services/SpendCapEnforcer";
import { getShopTier } from "../../src/utils/shopTier";

const mockedGetShopTier = getShopTier as jest.Mock;

function mockPool(rows: any[] = []) {
  const queryMock = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes("ai_usage_events")) return Promise.resolve({ rows });
    return Promise.resolve({ rowCount: rows.length }); // UPDATE / INSERT (rollover, provision, recordSpend)
  });
  return { query: queryMock } as any;
}

/** One derived-spend row as canSpend's query returns it. */
const spend = (v: string) => [{ derived_spend_usd: v, has_settings: true }];
/** The shop-has-no-settings-row case: the view still reports its spend. */
const noSettings = (v: string) => [{ derived_spend_usd: v, has_settings: false }];

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
    const enforcer = new SpendCapEnforcer(mockPool(noSettings("0.00")));
    const r = await enforcer.canSpend("missing_shop");
    expect(r.allowed).toBe(true);
    expect(r.useCheaperModel).toBe(false);
    expect(r.monthlyBudgetUsd).toBe(75);
    expect(r.currentSpendUsd).toBe(0);
  });

  // Regression: enforcement must NOT key off the settings row. Before the derived counter, a shop
  // with no ai_shop_settings row was waved through with spend=0 — so a wiped/never-provisioned row
  // was an unlimited free pass. The view knows about the spend regardless.
  it("still enforces on a shop with NO settings row but real spend in the audit", async () => {
    mockedGetShopTier.mockResolvedValueOnce("growth"); // $30
    const r = await new SpendCapEnforcer(mockPool(noSettings("35.00"))).canSpend("unprovisioned");
    expect(r.currentSpendUsd).toBe(35);
    expect(r.limitReached).toBe(true);
    expect(r.useCheaperModel).toBe(true);
  });
});

describe("SpendCapEnforcer.canSpend — derives from ai_usage_events, not the counter", () => {
  it("reads the view (the audit), never ai_shop_settings.current_month_spend_usd", async () => {
    const pool = mockPool(spend("9.00"));
    await new SpendCapEnforcer(pool).canSpend("s");
    const selects = pool.query.mock.calls.map((c: any) => String(c[0])).filter((s: string) => /^\s*SELECT/i.test(s));
    expect(selects.some((s: string) => s.includes("ai_usage_events"))).toBe(true);
    // The drifting counter must not be what the decision is made on.
    expect(selects.some((s: string) => /SELECT\s+current_month_spend_usd/i.test(s))).toBe(false);
  });

  it("scopes the sum to billable_to_shop and the current calendar month", async () => {
    const pool = mockPool(spend("0.00"));
    await new SpendCapEnforcer(pool).canSpend("s");
    const sql = pool.query.mock.calls.map((c: any) => String(c[0])).find((s: string) => s.includes("ai_usage_events"))!;
    expect(sql).toContain("billable_to_shop"); // ads spend bills to the ads budget (D3)
    expect(sql).toContain("DATE_TRUNC('month'"); // the calendar month IS the rollover
  });

  // A shop must not burn its allowance on OUR failures. The orchestrator has always passed 0 to
  // recordSpend on a failed call; deriving from the audit would have silently reversed that, since
  // failed calls still carry the tokens they burned.
  it("excludes errored calls — the shop is not charged for failed requests", async () => {
    const pool = mockPool(spend("0.00"));
    await new SpendCapEnforcer(pool).canSpend("s");
    const sql = pool.query.mock.calls.map((c: any) => String(c[0])).find((s: string) => s.includes("ai_usage_events"))!;
    expect(sql).toMatch(/NOT\s+e\.is_error/);
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
  const row = (v: string, overage: boolean) => [{ derived_spend_usd: v, ai_overage_enabled: overage, has_settings: true }];

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

  const row = (v: string, overage: boolean) => [{ derived_spend_usd: v, ai_overage_enabled: overage, has_settings: true }];

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
    [{ derived_spend_usd: v, ai_overage_enabled: overage, overage_cap_usd: cap, has_settings: true }];

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
  const noNotify = () => jest.fn().mockResolvedValue(undefined);

  it("accrues only the slice of the increment that crossed the cap ($28→$33 on $30 → $3)", async () => {
    const accrue = jest.fn().mockResolvedValue(undefined);
    await new SpendCapEnforcer(recordPool("33.00", true), accrue, noNotify()).recordSpend("s", 5); // before $28
    expect(accrue).toHaveBeenCalledWith("s", 3);
  });

  it("accrues the whole cost when already over the cap ($35→$37 → $2)", async () => {
    const accrue = jest.fn().mockResolvedValue(undefined);
    await new SpendCapEnforcer(recordPool("37.00", true), accrue, noNotify()).recordSpend("s", 2);
    expect(accrue).toHaveBeenCalledWith("s", 2);
  });

  it("does not accrue when the increment stays under the cap ($10→$15 on $30)", async () => {
    const accrue = jest.fn().mockResolvedValue(undefined);
    await new SpendCapEnforcer(recordPool("15.00", true), accrue, noNotify()).recordSpend("s", 5);
    expect(accrue).not.toHaveBeenCalled();
  });

  it("does not accrue when the shop has NOT opted into overage", async () => {
    const accrue = jest.fn().mockResolvedValue(undefined);
    await new SpendCapEnforcer(recordPool("40.00", false), accrue, noNotify()).recordSpend("s", 5);
    expect(accrue).not.toHaveBeenCalled();
  });

  it("does not accrue when the master flag is OFF", async () => {
    process.env.ENABLE_AI_OVERAGE = "false";
    const accrue = jest.fn().mockResolvedValue(undefined);
    await new SpendCapEnforcer(recordPool("40.00", true), accrue, noNotify()).recordSpend("s", 5);
    expect(accrue).not.toHaveBeenCalled();
  });

  it("never lets an accrual failure break recordSpend", async () => {
    const accrue = jest.fn().mockRejectedValue(new Error("ledger down"));
    await expect(
      new SpendCapEnforcer(recordPool("40.00", true), accrue, noNotify()).recordSpend("s", 5)
    ).resolves.toBeUndefined();
  });

  // #7 — overage-started notification fires exactly once, on the call that crosses the allowance.
  it("notifies the shop on the crossing call ($28→$33 on $30)", async () => {
    const notify = noNotify();
    await new SpendCapEnforcer(recordPool("33.00", true), jest.fn().mockResolvedValue(undefined), notify).recordSpend("s", 5);
    expect(notify).toHaveBeenCalledWith("s", 30);
  });

  it("does NOT notify when already over the cap (no crossing, $35→$37)", async () => {
    const notify = noNotify();
    await new SpendCapEnforcer(recordPool("37.00", true), jest.fn().mockResolvedValue(undefined), notify).recordSpend("s", 2);
    expect(notify).not.toHaveBeenCalled();
  });

  it("does NOT notify when overage is off", async () => {
    const notify = noNotify();
    await new SpendCapEnforcer(recordPool("33.00", false), jest.fn().mockResolvedValue(undefined), notify).recordSpend("s", 5);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("SpendCapEnforcer.recordSpend", () => {
  it("issues an UPDATE with the cost amount", async () => {
    const pool = mockPool(spend("5.00"));
    await new SpendCapEnforcer(pool).recordSpend("shop_a", 0.0234);
    const updateCall = pool.query.mock.calls.find(
      (c: any) => c[0].includes("UPDATE ai_shop_settings") && c[0].includes("current_month_spend_usd + $1::numeric")
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

  // The rollover is folded into the increment. canSpend rolls the month too, but nothing enforces
  // that every recordSpend is preceded by one — a recordSpend-only caller would otherwise accrue
  // into a stale month and have the lot zeroed by the next canSpend.
  it("rolls a stale month over inside the same UPDATE (no extra round-trip)", async () => {
    const pool = mockPool(spend("5.00"));
    await new SpendCapEnforcer(pool).recordSpend("shop_a", 0.25);
    const sql = pool.query.mock.calls
      .map((c: any) => String(c[0]))
      .find((s: string) => s.includes("UPDATE ai_shop_settings") && s.includes("current_month_spend_usd ="))!;
    expect(sql).toBeDefined();
    // Stale month → the increment REPLACES rather than adds, and the stamp advances.
    expect(sql).toMatch(/DATE_TRUNC\('month', current_month_started_at\) < DATE_TRUNC\('month', NOW\(\)\)/);
    expect(sql).toContain("current_month_started_at =");
    // Exactly one statement does both — a second rollover query would be a wasted round-trip.
    const updates = pool.query.mock.calls.filter((c: any) => String(c[0]).includes("UPDATE ai_shop_settings"));
    expect(updates).toHaveLength(1);
  });
});

// The month stamp records when the month BEGAN, not when a request happened to notice the rollover.
// With NOW(), a background sweep stamped whole batches of shops with the same mid-month second
// (staging showed clusters of 5, 7, 12 and 33 shops), making a genuinely anomalous mid-month value
// impossible to distinguish from routine noise.
describe("SpendCapEnforcer — month rollover stamps the start of the month", () => {
  it("canSpend's rollover sets DATE_TRUNC('month', NOW()), not NOW()", async () => {
    const pool = mockPool(spend("1.00"));
    await new SpendCapEnforcer(pool).canSpend("s");
    const sql = pool.query.mock.calls
      .map((c: any) => String(c[0]))
      .find((s: string) => s.includes("UPDATE ai_shop_settings") && s.includes("current_month_spend_usd = 0"))!;
    expect(sql).toBeDefined();
    expect(sql).toContain("current_month_started_at = DATE_TRUNC('month', NOW())");
    expect(sql).not.toMatch(/current_month_started_at\s*=\s*NOW\(\)/);
  });
});

// Surfaces with no per-feature cost table (brand-kit vision, FAQ suggestions, voice TTS) charged the
// counter but wrote no audit row anywhere. Once canSpend derives from the audit, that spend would be
// invisible to the cap — so those call sites pass a `ledger` entry and recordSpend writes it to
// ai_misc_usage, which the view unions in.
describe("SpendCapEnforcer.recordSpend — ai_misc_usage ledger (surfaces with no cost table)", () => {
  const ledgerInsert = (pool: any) =>
    pool.query.mock.calls.find((c: any) => String(c[0]).includes("INSERT INTO ai_misc_usage"));

  it("writes the audit row when a ledger entry is supplied", async () => {
    const pool = mockPool(spend("1.00"));
    await new SpendCapEnforcer(pool).recordSpend("shop_a", 0.0123, {
      feature: "voice_tts",
      vendor: "openai",
      latencyMs: 420,
      metadata: { charCount: 88 },
    });
    const call = ledgerInsert(pool);
    expect(call).toBeDefined();
    const [shopId, feature, vendor, model, inTok, outTok, cost, latency, metadata] = call![1];
    expect({ shopId, feature, vendor, model, inTok, outTok, cost, latency }).toEqual({
      shopId: "shop_a", feature: "voice_tts", vendor: "openai", model: null,
      inTok: 0, outTok: 0, cost: 0.0123, latency: 420,
    });
    expect(JSON.parse(metadata)).toEqual({ charCount: 88 });
  });

  // Surfaces that DO have their own table must not pass a ledger entry, or the view would count the
  // cost twice — once from their table and once from ai_misc_usage.
  it("writes NO ledger row when no entry is supplied (the default for surfaces that self-log)", async () => {
    const pool = mockPool(spend("1.00"));
    await new SpendCapEnforcer(pool).recordSpend("shop_a", 0.5);
    expect(ledgerInsert(pool)).toBeUndefined();
  });

  it("writes no ledger row for cost <= 0 (nothing was billed)", async () => {
    const pool = mockPool(spend("1.00"));
    await new SpendCapEnforcer(pool).recordSpend("shop_a", 0, { feature: "brand_kit", vendor: "anthropic" });
    expect(ledgerInsert(pool)).toBeUndefined();
  });

  it("still increments the counter when the ledger write fails", async () => {
    const pool = {
      query: jest.fn().mockImplementation((sql: string) =>
        String(sql).includes("INSERT INTO ai_misc_usage")
          ? Promise.reject(new Error("ledger down"))
          : Promise.resolve({ rows: [{ current_month_spend_usd: "1.00", ai_overage_enabled: false }] })
      ),
    } as any;
    await expect(
      new SpendCapEnforcer(pool).recordSpend("shop_a", 0.25, { feature: "faq_suggestion", vendor: "anthropic" })
    ).resolves.toBeUndefined();
    expect(
      pool.query.mock.calls.some((c: any) => String(c[0]).includes("current_month_spend_usd + $1::numeric"))
    ).toBe(true);
  });
});
