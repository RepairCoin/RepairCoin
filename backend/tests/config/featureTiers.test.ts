// WS2 feature gating — the tier→feature matrix + cumulative entitlement. Pure, no DB.
import { FEATURE_TIERS, tierAllowsFeature, getRequiredTier } from "../../src/config/featureTiers";

describe("featureTiers matrix", () => {
  it("gates the WS2 features at the locked tiers (2026-07-14)", () => {
    expect(FEATURE_TIERS.aiImageGen).toBe("growth");      // AI Images toggle
    expect(FEATURE_TIERS.aiLeadFollowUp).toBe("growth");  // Follow-up Nudges toggle
    expect(FEATURE_TIERS.campaignRewards).toBe("growth"); // Campaign Rewards toggle
    expect(FEATURE_TIERS.voiceAiAssistant).toBe("growth");
    expect(FEATURE_TIERS.aiMemory).toBe("business");
    expect(FEATURE_TIERS.aiAutoReplies).toBe("business");
  });
});

describe("tierAllowsFeature — cumulative (min-tier)", () => {
  it("a Growth feature is available on Growth AND Business, denied on Starter", () => {
    expect(tierAllowsFeature("starter", "aiImageGen")).toBe(false);
    expect(tierAllowsFeature("growth", "aiImageGen")).toBe(true);
    expect(tierAllowsFeature("business", "aiImageGen")).toBe(true); // cumulative
  });

  it("a Business feature is Business-only", () => {
    expect(tierAllowsFeature("starter", "aiMemory")).toBe(false);
    expect(tierAllowsFeature("growth", "aiMemory")).toBe(false);
    expect(tierAllowsFeature("business", "aiMemory")).toBe(true);
  });

  it("the AI Sales Agent master (not in the matrix) is ungated — allowed on every tier", () => {
    expect(getRequiredTier("aiGlobalEnabled")).toBeUndefined();
    expect(tierAllowsFeature("starter", "aiGlobalEnabled")).toBe(true);
    expect(tierAllowsFeature("growth", "aiGlobalEnabled")).toBe(true);
    expect(tierAllowsFeature("business", "aiGlobalEnabled")).toBe(true);
  });
});
