// Entitlement at the ENGINE, not just the API.
//
// autoMessageGuard stops a below-tier shop from MANAGING automations, but the scheduler never asked —
// so a shop that downgraded or cancelled kept having its rules executed indefinitely. The gate now
// also sits in the send path (AutoMessageSchedulerService.isShopEntitled).
//
// The subtle requirement these tests pin down: the engine must use the ROLLOUT-AWARE check. While
// aiCampaignsAdvanced is shipped dark, every tier is allowed, so the engine must keep sending —
// enforcing early would cut off shops whose UI still shows the feature as open. Swapping
// shopHasFeatureEffective for plain shopHasFeature would silently break exactly that.
//
// These exercise the pure decision layer both helpers delegate to. (Testing the async wrappers by
// spying on getShopTier does NOT work: they call it module-internally, so the spy never intercepts —
// the first version of this file "passed" while hitting the real database.)

import { effectiveTierAllows, tierAllowsFeature } from "../../src/config/featureTiers";

const FEATURE = "aiCampaignsAdvanced";
const TIERS = ["free", "starter", "growth", "business"] as const;

describe("automation entitlement — rollout-aware vs raw tier check", () => {
  const ORIG = process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER;
    else process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER = ORIG;
  });

  it("while the gate is DARK, every tier keeps running automations", () => {
    delete process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER;
    for (const tier of TIERS) {
      expect({ tier, allowed: effectiveTierAllows(tier as any, FEATURE) }).toEqual({ tier, allowed: true });
    }
  });

  it("once enforcement is ON, only Business runs automations", () => {
    process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER = "true";
    for (const tier of TIERS) {
      expect({ tier, allowed: effectiveTierAllows(tier as any, FEATURE) }).toEqual({
        tier,
        allowed: tier === "business",
      });
    }
  });

  // The trap: the raw check ignores the rollout flag entirely. If the scheduler used it, a free-tier
  // shop's automations would have stopped while the routes and UI still said the feature was open.
  it("the RAW check would have cut off shops while the gate was still dark", () => {
    delete process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER;
    expect(tierAllowsFeature("free" as any, FEATURE)).toBe(false); // raw: denied
    expect(effectiveTierAllows("free" as any, FEATURE)).toBe(true); // rollout-aware: still allowed
  });

  it("the two agree once enforcement is on — the difference exists only during rollout", () => {
    process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER = "true";
    for (const tier of TIERS) {
      expect({ tier, raw: tierAllowsFeature(tier as any, FEATURE) }).toEqual({
        tier,
        raw: effectiveTierAllows(tier as any, FEATURE),
      });
    }
  });
});
