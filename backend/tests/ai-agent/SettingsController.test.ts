// backend/tests/ai-agent/SettingsController.test.ts
//
// Verify GET /api/ai/settings + PUT /api/ai/settings (shop) and the
// pure validation. The key guarantee: a shop can only edit the two
// behavior fields — gate fields in the body are never trusted. Budget is
// tier-derived + read-only (getShopAiBudget, mocked to $30 = growth).

jest.mock("../../src/utils/shopTier", () => ({ getShopAiBudget: jest.fn().mockResolvedValue(30) }));

import {
  makeSettingsControllers,
  validateShopAiSettingsUpdate,
  validateAdminShopAiSettingsUpdate,
} from "../../src/domains/AIAgentDomain/controllers/SettingsController";

const makeReq = (opts: { user?: any; body?: any; params?: any } = {}) =>
  ({ user: opts.user ?? {}, body: opts.body, params: opts.params ?? {} } as any);

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

const settingsRow = (overrides: any = {}) => ({
  ai_global_enabled: true,
  ai_followup_enabled: false,
  ai_followup_delay_minutes: 20,
  escalation_threshold: 5,
  monthly_budget_usd: "20.00",
  current_month_spend_usd: "3.50",
  human_reply_baseline_minutes: 240,
  ...overrides,
});

// ----- Pure validation -----

describe("validateShopAiSettingsUpdate", () => {
  it("accepts valid in-range values", () => {
    const r = validateShopAiSettingsUpdate({
      escalationThreshold: 5,
      aiFollowupDelayMinutes: 20,
    });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ escalationThreshold: 5, aiFollowupDelayMinutes: 20 });
  });

  it("ignores gate fields in the body (only the 2 editable fields survive)", () => {
    const r = validateShopAiSettingsUpdate({
      escalationThreshold: 8,
      aiFollowupDelayMinutes: 15,
      aiGlobalEnabled: true,
      aiFollowupEnabled: true,
      monthlyBudgetUsd: 9999,
    });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ escalationThreshold: 8, aiFollowupDelayMinutes: 15 });
    expect(r.value as any).not.toHaveProperty("aiGlobalEnabled");
    expect(r.value as any).not.toHaveProperty("monthlyBudgetUsd");
  });

  it.each([0, 21, 5.5, -1, "5", null])(
    "rejects escalationThreshold = %p",
    (bad) => {
      const r = validateShopAiSettingsUpdate({
        escalationThreshold: bad,
        aiFollowupDelayMinutes: 20,
      });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/escalationThreshold/);
    }
  );

  it.each([14, 31, 22.5, 0, "20"])(
    "rejects aiFollowupDelayMinutes = %p",
    (bad) => {
      const r = validateShopAiSettingsUpdate({
        escalationThreshold: 5,
        aiFollowupDelayMinutes: bad,
      });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/aiFollowupDelayMinutes/);
    }
  );

  it("rejects a non-object body", () => {
    expect(validateShopAiSettingsUpdate(null).ok).toBe(false);
    expect(validateShopAiSettingsUpdate(undefined).ok).toBe(false);
    expect(validateShopAiSettingsUpdate("nope").ok).toBe(false);
  });

  it("accepts the boundary values (15/30 and 1/20)", () => {
    expect(
      validateShopAiSettingsUpdate({ escalationThreshold: 1, aiFollowupDelayMinutes: 15 }).ok
    ).toBe(true);
    expect(
      validateShopAiSettingsUpdate({ escalationThreshold: 20, aiFollowupDelayMinutes: 30 }).ok
    ).toBe(true);
  });

  // ----- Optional humanReplyBaselineMinutes (added 2026-05-20 for Impact Metrics) -----

  it("treats humanReplyBaselineMinutes as optional — omits it from value when absent", () => {
    const r = validateShopAiSettingsUpdate({ escalationThreshold: 5, aiFollowupDelayMinutes: 20 });
    expect(r.ok).toBe(true);
    expect(r.value).not.toHaveProperty("humanReplyBaselineMinutes");
  });

  it("accepts a valid humanReplyBaselineMinutes when present", () => {
    const r = validateShopAiSettingsUpdate({
      escalationThreshold: 5,
      aiFollowupDelayMinutes: 20,
      humanReplyBaselineMinutes: 120,
    });
    expect(r.ok).toBe(true);
    expect(r.value?.humanReplyBaselineMinutes).toBe(120);
  });

  it("accepts the humanReplyBaselineMinutes boundary values (15 and 1440)", () => {
    expect(
      validateShopAiSettingsUpdate({
        escalationThreshold: 5,
        aiFollowupDelayMinutes: 20,
        humanReplyBaselineMinutes: 15,
      }).ok
    ).toBe(true);
    expect(
      validateShopAiSettingsUpdate({
        escalationThreshold: 5,
        aiFollowupDelayMinutes: 20,
        humanReplyBaselineMinutes: 1440,
      }).ok
    ).toBe(true);
  });

  it.each([0, 14, 1441, 60.5, -1, "240", null])(
    "rejects humanReplyBaselineMinutes = %p",
    (bad) => {
      const r = validateShopAiSettingsUpdate({
        escalationThreshold: 5,
        aiFollowupDelayMinutes: 20,
        humanReplyBaselineMinutes: bad,
      });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/humanReplyBaselineMinutes/);
    }
  );
});

// ----- GET /api/ai/settings -----

describe("SettingsController.getOwnShopAiSettings", () => {
  it("returns 401 when no shopId in the JWT", async () => {
    const controllers = makeSettingsControllers({ pool: makePool([]) as any });
    const res = makeRes();
    await controllers.getOwnShopAiSettings(makeReq({ user: { role: "shop" } }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns the shop's settings snapshot", async () => {
    const pool = makePool([[settingsRow()]]);
    const controllers = makeSettingsControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.getOwnShopAiSettings(
      makeReq({ user: { role: "shop", shopId: "peanut" } }),
      res
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        aiGlobalEnabled: true,
        aiFollowupEnabled: false,
        aiImagesEnabled: false,
        campaignRewardsEnabled: false,
        monthlyBudgetUsd: 30,
        currentMonthSpendUsd: 3.5,
        escalationThreshold: 5,
        aiFollowupDelayMinutes: 20,
        humanReplyBaselineMinutes: 240,
        assistantName: null,
      },
    });
  });

  it("returns defaults when the shop has no settings row", async () => {
    const pool = makePool([[]]);
    const controllers = makeSettingsControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.getOwnShopAiSettings(
      makeReq({ user: { role: "shop", shopId: "fresh-shop" } }),
      res
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        aiGlobalEnabled: false,
        aiFollowupEnabled: false,
        escalationThreshold: 5,
        aiFollowupDelayMinutes: 20,
      }),
    });
  });
});

// ----- PUT /api/ai/settings -----

describe("SettingsController.updateOwnShopAiSettings", () => {
  it("returns 401 when no shopId in the JWT", async () => {
    const controllers = makeSettingsControllers({ pool: makePool([]) as any });
    const res = makeRes();
    await controllers.updateOwnShopAiSettings(
      makeReq({ user: { role: "shop" }, body: { escalationThreshold: 5, aiFollowupDelayMinutes: 20 } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 on an invalid body", async () => {
    const controllers = makeSettingsControllers({ pool: makePool([]) as any });
    const res = makeRes();
    await controllers.updateOwnShopAiSettings(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        body: { escalationThreshold: 99, aiFollowupDelayMinutes: 20 },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("upserts the two editable fields and returns the fresh snapshot", async () => {
    // query 1 = upsert, query 2 = re-select
    const pool = makePool([[], [settingsRow({ escalation_threshold: 8, ai_followup_delay_minutes: 25 })]]);
    const controllers = makeSettingsControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.updateOwnShopAiSettings(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        body: { escalationThreshold: 8, aiFollowupDelayMinutes: 25 },
      }),
      res
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ escalationThreshold: 8, aiFollowupDelayMinutes: 25 }),
    });
  });

  it("never writes gate fields — the upsert SQL only carries shopId + the 2 editable fields", async () => {
    const pool = makePool([[], [settingsRow()]]);
    const controllers = makeSettingsControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.updateOwnShopAiSettings(
      makeReq({
        user: { role: "shop", shopId: "peanut" },
        body: {
          escalationThreshold: 6,
          aiFollowupDelayMinutes: 18,
          // hostile extras — must be ignored
          aiGlobalEnabled: true,
          aiFollowupEnabled: true,
          monthlyBudgetUsd: 9999,
        },
      }),
      res
    );
    const upsertCall = (pool.query as jest.Mock).mock.calls[0];
    const sql = upsertCall[0] as string;
    const params = upsertCall[1] as any[];
    // Only the gate-safe columns appear in the write.
    expect(sql).toContain("escalation_threshold");
    expect(sql).toContain("ai_followup_delay_minutes");
    expect(sql).not.toMatch(/ai_global_enabled|ai_followup_enabled|monthly_budget_usd/);
    expect(params).toEqual(["peanut", 6, 18]);
  });
});

// ----- Admin gate: validation -----

describe("validateAdminShopAiSettingsUpdate", () => {
  it("accepts a single-field partial update", () => {
    const r = validateAdminShopAiSettingsUpdate({ aiFollowupEnabled: true });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ aiFollowupEnabled: true });
  });

  it("accepts the boolean gate fields", () => {
    const r = validateAdminShopAiSettingsUpdate({
      aiGlobalEnabled: true,
      aiFollowupEnabled: false,
    });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ aiGlobalEnabled: true, aiFollowupEnabled: false });
  });

  it("IGNORES monthlyBudgetUsd — the AI budget is tier-derived + read-only, not settable", () => {
    const r = validateAdminShopAiSettingsUpdate({ aiGlobalEnabled: true, monthlyBudgetUsd: 50 });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ aiGlobalEnabled: true }); // monthlyBudgetUsd dropped
    // A body with ONLY monthlyBudgetUsd has no settable field → rejected as empty.
    expect(validateAdminShopAiSettingsUpdate({ monthlyBudgetUsd: 50 }).ok).toBe(false);
  });

  it("rejects an empty body (no gate fields provided)", () => {
    const r = validateAdminShopAiSettingsUpdate({});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/at least one/i);
  });

  it.each([1, "true", null])("rejects non-boolean aiGlobalEnabled = %p", (bad) => {
    const r = validateAdminShopAiSettingsUpdate({ aiGlobalEnabled: bad });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(validateAdminShopAiSettingsUpdate(null).ok).toBe(false);
  });
});

// ----- Admin gate: GET /api/ai/admin/shop-settings -----

describe("SettingsController.listShopAiSettings", () => {
  it("returns every shop's AI settings, mapped", async () => {
    const pool = makePool([
      [
        {
          shop_id: "peanut",
          shop_name: "Peanut Repairs",
          ai_global_enabled: true,
          ai_followup_enabled: false,
          ai_followup_delay_minutes: 15,
          escalation_threshold: 5,
          monthly_budget_usd: "20.00",
          current_month_spend_usd: "9.36",
        },
      ],
    ]);
    const controllers = makeSettingsControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.listShopAiSettings(makeReq({ user: { role: "admin" } }), res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        {
          shopId: "peanut",
          shopName: "Peanut Repairs",
          aiGlobalEnabled: true,
          aiFollowupEnabled: false,
          aiImagesEnabled: false,
          campaignRewardsEnabled: false,
          monthlyBudgetUsd: 30,
          currentMonthSpendUsd: 9.36,
          escalationThreshold: 5,
          aiFollowupDelayMinutes: 15,
          // Admin row mock omits human_reply_baseline_minutes → controller
          // falls back to DEFAULT_HUMAN_REPLY_BASELINE_MINUTES.
          humanReplyBaselineMinutes: 240,
        },
      ],
    });
  });
});

// ----- Admin gate: PUT /api/ai/admin/shop-settings/:shopId -----

describe("SettingsController.adminUpdateShopAiSettings", () => {
  it("returns 400 when no :shopId param", async () => {
    const controllers = makeSettingsControllers({ pool: makePool([]) as any });
    const res = makeRes();
    await controllers.adminUpdateShopAiSettings(
      makeReq({ user: { role: "admin" }, body: { aiGlobalEnabled: true } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 on an invalid body", async () => {
    const controllers = makeSettingsControllers({ pool: makePool([]) as any });
    const res = makeRes();
    await controllers.adminUpdateShopAiSettings(
      makeReq({ user: { role: "admin" }, params: { shopId: "peanut" }, body: {} }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("upserts only the provided gate field and returns the fresh row", async () => {
    const pool = makePool([
      [], // upsert
      [
        {
          shop_id: "peanut",
          shop_name: "Peanut",
          ai_global_enabled: true,
          ai_followup_enabled: true,
          ai_followup_delay_minutes: 15,
          escalation_threshold: 5,
          monthly_budget_usd: "20.00",
          current_month_spend_usd: "0",
        },
      ],
    ]);
    const controllers = makeSettingsControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.adminUpdateShopAiSettings(
      makeReq({
        user: { role: "admin" },
        params: { shopId: "peanut" },
        body: { aiFollowupEnabled: true },
      }),
      res
    );

    // The upsert query should carry ONLY shop_id + the one provided column.
    const upsertCall = (pool.query as jest.Mock).mock.calls[0];
    const sql = upsertCall[0] as string;
    const params = upsertCall[1] as any[];
    expect(sql).toContain("ai_followup_enabled");
    expect(sql).not.toMatch(/ai_global_enabled|monthly_budget_usd/);
    expect(params).toEqual(["peanut", true]);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ shopId: "peanut", aiFollowupEnabled: true }),
    });
  });

  it("returns 404 when the shop row can't be found after the upsert", async () => {
    const pool = makePool([[], []]); // upsert ok, re-select empty
    const controllers = makeSettingsControllers({ pool: pool as any });
    const res = makeRes();
    await controllers.adminUpdateShopAiSettings(
      makeReq({
        user: { role: "admin" },
        params: { shopId: "ghost" },
        body: { aiGlobalEnabled: true },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
