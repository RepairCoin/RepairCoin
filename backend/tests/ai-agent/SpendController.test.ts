// backend/tests/ai-agent/SpendController.test.ts
//
// Phase 3 Task 12 — verify the GET /api/ai/spend (shop) and
// GET /api/ai/admin/cost-summary (admin) endpoints.

// Budget is now tier-derived (getShopAiBudget) — mock it deterministically ($30 = growth).
jest.mock("../../src/utils/shopTier", () => ({ getShopAiBudget: jest.fn().mockResolvedValue(30) }));

import { makeSpendControllers } from "../../src/domains/AIAgentDomain/controllers/SpendController";

const makeReq = (opts: { user?: any } = {}) =>
  ({ user: opts.user ?? {} } as any);

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makePool = (rowsByQuery: Array<any[]>) => ({
  query: jest.fn().mockImplementation(() => {
    const next = rowsByQuery.shift();
    return Promise.resolve({ rows: next ?? [] });
  }),
});

describe("SpendController.getOwnShopSpend", () => {
  it("returns 401 when no shopId in JWT", async () => {
    const controllers = makeSpendControllers({ pool: makePool([]) as any });
    const req = makeReq({ user: { role: "shop" } });
    const res = makeRes();
    await controllers.getOwnShopSpend(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns spend snapshot for the authenticated shop", async () => {
    const pool = makePool([
      // First query: ai_shop_settings
      [
        {
          monthly_budget_usd: "20.00",
          current_month_spend_usd: "1.25",
          current_month_started_at: new Date("2026-05-01"),
        },
      ],
      // Second query: count of successful calls this month
      [{ count: "42" }],
    ]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const req = makeReq({ user: { role: "shop", shopId: "peanut" } });
    const res = makeRes();
    await controllers.getOwnShopSpend(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        currentMonthSpendUsd: 1.25,
        monthlyBudgetUsd: 30,
        percentUsed: 1.25 / 30,
        callsThisMonth: 42,
      }),
    });
  });

  it("returns zero-spend snapshot when shop has no ai_shop_settings row yet", async () => {
    // First query returns no rows — shop has never been initialized
    const pool = makePool([[]]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const req = makeReq({ user: { role: "shop", shopId: "fresh-shop" } });
    const res = makeRes();
    await controllers.getOwnShopSpend(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        currentMonthSpendUsd: 0,
        monthlyBudgetUsd: 30,
        percentUsed: 0,
        monthStartedAt: null,
        callsThisMonth: 0,
        overageEnabled: false,
        overageAvailable: false, // ENABLE_AI_OVERAGE not set in test env
        overageCapUsd: null,
        overageCapDefaultUsd: 100, // platform default (AI_OVERAGE_MONTHLY_CAP_USD unset in test env)
      },
    });
    // Should NOT have queried ai_agent_messages — early return after empty settings
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on DB failure", async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error("connection refused")),
    };
    const controllers = makeSpendControllers({ pool: pool as any });
    const req = makeReq({ user: { role: "shop", shopId: "peanut" } });
    const res = makeRes();
    await controllers.getOwnShopSpend(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("SpendController.getAdminCostSummary", () => {
  it("aggregates audit log + per-shop counters into a single response", async () => {
    const pool = makePool([
      // Query 1: audit aggregate
      [
        {
          total_calls: "150",
          successful_calls: "147",
          failed_calls: "3",
          total_cost_usd: "4.875",
          total_input_tokens: "150000",
          total_output_tokens: "12000",
        },
      ],
      // Query 2: top spenders
      [
        { shop_id: "peanut", calls: "80", cost_usd: "2.5" },
        { shop_id: "zwift-tech", calls: "67", cost_usd: "2.375" },
      ],
      // Query 3: per-shop counters
      [
        {
          shops_with_spend: "5",
          ai_enabled_shops: "8",
          counter_total_usd: "4.80",
        },
      ],
    ]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const req = makeReq({ user: { role: "admin" } });
    const res = makeRes();
    await controllers.getAdminCostSummary(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        month: {
          totalCalls: 150,
          successfulCalls: 147,
          failedCalls: 3,
          errorRate: 3 / 150,
          totalCostUsd: 4.875,
          // 4.875 / 147 = 0.0331632...
          avgCostPerCallUsd: 4.875 / 147,
          totalInputTokens: 150000,
          totalOutputTokens: 12000,
        },
        topSpenders: [
          { shopId: "peanut", calls: 80, costUsd: 2.5 },
          { shopId: "zwift-tech", calls: 67, costUsd: 2.375 },
        ],
        shopCounters: {
          shopsWithSpend: 5,
          aiEnabledShops: 8,
          denormalizedTotalUsd: 4.8,
          // Audit total ($4.875) - counter total ($4.80) = $0.075 drift
          counterDriftUsd: 4.875 - 4.8,
        },
      },
    });
  });

  it("handles zero data gracefully (new platform with no AI calls yet)", async () => {
    const pool = makePool([
      [
        {
          total_calls: "0",
          successful_calls: "0",
          failed_calls: "0",
          total_cost_usd: "0",
          total_input_tokens: "0",
          total_output_tokens: "0",
        },
      ],
      [],
      [
        {
          shops_with_spend: "0",
          ai_enabled_shops: "0",
          counter_total_usd: "0",
        },
      ],
    ]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.getAdminCostSummary(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.month.totalCalls).toBe(0);
    expect(body.data.month.errorRate).toBe(0);
    expect(body.data.month.avgCostPerCallUsd).toBe(0);
    expect(body.data.topSpenders).toEqual([]);
  });

  it("returns 500 on DB failure", async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error("connection refused")),
    };
    const controllers = makeSpendControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.getAdminCostSummary(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("SpendController.setOwnShopOverage (AI Usage Overage, T3.2)", () => {
  const ORIG = process.env.ENABLE_AI_OVERAGE;
  afterEach(() => { process.env.ENABLE_AI_OVERAGE = ORIG; });

  const reqWith = (shopId: any, body: any) => ({ user: shopId ? { role: "shop", shopId } : {}, body } as any);

  it("returns 401 without a shopId", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const controllers = makeSpendControllers({ pool: makePool([]) as any });
    const res = makeRes();
    await controllers.setOwnShopOverage(reqWith(null, { enabled: true }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 409 when the feature flag is off", async () => {
    process.env.ENABLE_AI_OVERAGE = "false";
    const pool = makePool([]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.setOwnShopOverage(reqWith("peanut", { enabled: true }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(pool.query).not.toHaveBeenCalled(); // no DB write when unavailable
  });

  it("returns 400 when `enabled` is not a boolean", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const controllers = makeSpendControllers({ pool: makePool([]) as any });
    const res = makeRes();
    await controllers.setOwnShopOverage(reqWith("peanut", { enabled: "yes" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("requires consent to ENABLE (400 without it, no DB write)", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const pool = makePool([]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.setOwnShopOverage(reqWith("peanut", { enabled: true }), res); // no consent
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("enables with consent + card on file, stamping the consent timestamp", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const pool = makePool([[]]);
    const controllers = makeSpendControllers({ pool: pool as any, hasPaymentMethod: async () => true });
    const res = makeRes();
    await controllers.setOwnShopOverage(reqWith("peanut", { enabled: true, consent: true }), res);
    const upsert = pool.query.mock.calls.find((c: any) => String(c[0]).includes("INSERT INTO ai_shop_settings"));
    expect(upsert).toBeDefined();
    expect(upsert[1]).toEqual(["peanut", true]);
    expect(String(upsert[0])).toContain("ai_overage_consent_at = NOW()"); // stamped on enable
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { overageEnabled: true } });
  });

  it("returns 402 when enabling without a payment method on file (no DB write)", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    process.env.AI_OVERAGE_REQUIRE_CARD = "true";
    const pool = makePool([]);
    const controllers = makeSpendControllers({ pool: pool as any, hasPaymentMethod: async () => false });
    const res = makeRes();
    await controllers.setOwnShopOverage(reqWith("peanut", { enabled: true, consent: true }), res);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(pool.query).not.toHaveBeenCalled();
    delete process.env.AI_OVERAGE_REQUIRE_CARD;
  });

  it("skips the card check when AI_OVERAGE_REQUIRE_CARD=false (staging bypass)", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    process.env.AI_OVERAGE_REQUIRE_CARD = "false";
    const pool = makePool([[]]);
    let cardChecked = false;
    const controllers = makeSpendControllers({
      pool: pool as any,
      hasPaymentMethod: async () => { cardChecked = true; return false; },
    });
    const res = makeRes();
    await controllers.setOwnShopOverage(reqWith("peanut", { enabled: true, consent: true }), res);
    expect(cardChecked).toBe(false); // bypassed
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { overageEnabled: true } });
    delete process.env.AI_OVERAGE_REQUIRE_CARD;
  });

  it("disables without needing consent", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const pool = makePool([[]]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.setOwnShopOverage(reqWith("peanut", { enabled: false }), res);
    const upsert = pool.query.mock.calls.find((c: any) => String(c[0]).includes("INSERT INTO ai_shop_settings"));
    expect(String(upsert[0])).not.toContain("ai_overage_consent_at = NOW()"); // not stamped on disable
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { overageEnabled: false } });
  });
});

describe("SpendController.setOwnShopOverageCap (per-shop cap, T3.2)", () => {
  const ORIG = process.env.ENABLE_AI_OVERAGE;
  afterEach(() => { process.env.ENABLE_AI_OVERAGE = ORIG; });

  const reqWith = (shopId: any, body: any) => ({ user: shopId ? { role: "shop", shopId } : {}, body } as any);

  it("returns 401 without a shopId", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const controllers = makeSpendControllers({ pool: makePool([]) as any });
    const res = makeRes();
    await controllers.setOwnShopOverageCap(reqWith(null, { capUsd: 25 }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 409 when the feature flag is off (no DB write)", async () => {
    process.env.ENABLE_AI_OVERAGE = "false";
    const pool = makePool([]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.setOwnShopOverageCap(reqWith("peanut", { capUsd: 25 }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-positive cap (no DB write)", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const pool = makePool([]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.setOwnShopOverageCap(reqWith("peanut", { capUsd: 0 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("sets a positive cap (rounded to cents) and upserts it", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const pool = makePool([[]]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.setOwnShopOverageCap(reqWith("peanut", { capUsd: 49.999 }), res);
    const upsert = pool.query.mock.calls.find((c: any) => String(c[0]).includes("overage_cap_usd"));
    expect(upsert).toBeDefined();
    expect(upsert[1]).toEqual(["peanut", 50]); // 49.999 → 50.00 clamped to cents
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ overageCapUsd: 50 }) }));
  });

  it("clears the cap (null) → inherit the platform default", async () => {
    process.env.ENABLE_AI_OVERAGE = "true";
    const pool = makePool([[]]);
    const controllers = makeSpendControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.setOwnShopOverageCap(reqWith("peanut", { capUsd: null }), res);
    const upsert = pool.query.mock.calls.find((c: any) => String(c[0]).includes("overage_cap_usd"));
    expect(upsert[1]).toEqual(["peanut", null]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ overageCapUsd: null }) }));
  });
});

describe("SpendController.getAdminOverageSummary (T3.2 admin rollup)", () => {
  const ORIG = process.env.AI_OVERAGE_STRIPE_ENABLED;
  afterEach(() => { process.env.AI_OVERAGE_STRIPE_ENABLED = ORIG; });

  const summary = {
    shops: [{ shopId: "s1", shopName: "Alpha", overageCostCents: 4, amountCents: 12, status: "pending" }],
    grandTotal: { overageCostCents: 4, amountCents: 12, shopCount: 1 },
  };
  const pending = {
    shops: [{ shopId: "s1", shopName: "Alpha", amountCents: 30, monthCount: 1 }],
    grandTotal: { amountCents: 30, shopCount: 1 },
  };

  it("returns the this-month rollup + ready-to-invoice pending + stripeEnabled flag", async () => {
    process.env.AI_OVERAGE_STRIPE_ENABLED = "true";
    const controllers = makeSpendControllers({
      getOverageSummary: async () => summary,
      getPendingOverage: async () => pending,
    });
    const res = makeRes();
    await controllers.getAdminOverageSummary(makeReq({ user: { role: "admin" } }), res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { ...summary, pending, stripeEnabled: true },
    });
  });

  it("reports stripeEnabled:false when charging is off", async () => {
    process.env.AI_OVERAGE_STRIPE_ENABLED = "false";
    const controllers = makeSpendControllers({
      getOverageSummary: async () => summary,
      getPendingOverage: async () => pending,
    });
    const res = makeRes();
    await controllers.getAdminOverageSummary(makeReq({ user: { role: "admin" } }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stripeEnabled: false }),
    }));
  });

  it("returns 500 on a repo error", async () => {
    const controllers = makeSpendControllers({
      getOverageSummary: async () => { throw new Error("db down"); },
      getPendingOverage: async () => pending,
    });
    const res = makeRes();
    await controllers.getAdminOverageSummary(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
