// Tiers a shop can buy. 'free' is excluded — it has no price and is never selected.
export type PaidShopTier = 'starter' | 'growth' | 'business';

// Every tier a shop can resolve to. 'free' is the implicit tier for a shop with no active
// subscription (fresh signup, or a lapsed trial).
export type ShopTier = PaidShopTier | 'free';

// Mirror of backend/src/config/featureTiers.ts. Minimum tier per gated feature;
// empty until features are gated. Any feature absent here is available on every tier,
// including 'free'.
export const FEATURE_TIERS: Record<string, PaidShopTier> = {
  // Growth (also available on Business — cumulative). Decisions locked 2026-07-14.
  inventoryManagement: 'growth',
  campaignBuilder: 'growth',
  advancedReports: 'growth',
  aiImageGen: 'growth',        // AI Image & Content Generator (admin "AI Images" toggle)
  aiLeadFollowUp: 'growth',    // AI Lead Follow-Up (admin "Follow-up Nudges" toggle)
  campaignRewards: 'growth',   // Campaign Rewards (admin "Campaign Rewards" toggle)
  voiceAiAssistant: 'growth',
  aiMarketingSuite: 'growth',
  aiInsights: 'growth',
  // Business-only.
  teamManagement: 'business',
  multiLocation: 'business',
  aiMemory: 'business',
  aiAutoReplies: 'business',
  aiCampaignsAdvanced: 'business',
  advancedInventory: 'business',
  // AI Sales Agent master on/off (ai_global_enabled) is Starter+ = intentionally NOT gated.
};

export const TIER_LABELS: Record<ShopTier, string> = {
  free: 'Free',
  starter: 'Starter AI',
  growth: 'Growth AI',
  business: 'Business AI',
};

const TIER_RANK: Record<ShopTier, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  business: 3,
};

export function tierAllowsFeature(tier: ShopTier, feature: string): boolean {
  const required = FEATURE_TIERS[feature];
  if (!required) return true;
  // An unrecognised tier falls to rank 0 = 'free', the most restrictive.
  return (TIER_RANK[tier] ?? 0) >= TIER_RANK[required];
}

// Always a paid tier: 'free' is never a *requirement*, only a resolved state.
export function getRequiredTier(feature: string): PaidShopTier | undefined {
  return FEATURE_TIERS[feature];
}
