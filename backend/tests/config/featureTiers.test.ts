// WS2 feature gating — the tier→feature matrix + cumulative entitlement. Pure, no DB.
import {
  FEATURE_TIERS,
  tierAllowsFeature,
  getRequiredTier,
  effectiveTierAllows,
  isTierEnforcementDeferred,
} from "../../src/config/featureTiers";

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

describe("effectiveTierAllows — rollout-flag deferral (aiCampaignsAdvanced)", () => {
  const ORIG = process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER;
  afterEach(() => { process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER = ORIG; });

  it("flag OFF → enforcement deferred → allowed on EVERY tier (feature stays open)", () => {
    delete process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER;
    expect(isTierEnforcementDeferred("aiCampaignsAdvanced")).toBe(true);
    expect(effectiveTierAllows("starter", "aiCampaignsAdvanced")).toBe(true);
    expect(effectiveTierAllows("growth", "aiCampaignsAdvanced")).toBe(true);
    expect(effectiveTierAllows("business", "aiCampaignsAdvanced")).toBe(true);
  });

  it("flag ON → enforces the Business tier (Starter/Growth denied)", () => {
    process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER = "true";
    expect(isTierEnforcementDeferred("aiCampaignsAdvanced")).toBe(false);
    expect(effectiveTierAllows("starter", "aiCampaignsAdvanced")).toBe(false);
    expect(effectiveTierAllows("growth", "aiCampaignsAdvanced")).toBe(false);
    expect(effectiveTierAllows("business", "aiCampaignsAdvanced")).toBe(true);
  });

  it("non-rollout features are unaffected by the flag (behave like tierAllowsFeature)", () => {
    process.env.ENFORCE_CAMPAIGN_AUTOMATION_TIER = "true";
    expect(isTierEnforcementDeferred("campaignBuilder")).toBe(false);
    expect(effectiveTierAllows("growth", "campaignBuilder")).toBe(true);  // Growth feature, still allowed
    expect(effectiveTierAllows("growth", "aiMemory")).toBe(false);        // Business feature, still denied
  });
});
