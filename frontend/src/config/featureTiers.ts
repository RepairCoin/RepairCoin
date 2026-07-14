export type ShopTier = 'starter' | 'growth' | 'business';

// Mirror of backend/src/config/featureTiers.ts. Minimum tier per gated feature;
// empty until features are gated. Any feature absent here is available on every tier.
export const FEATURE_TIERS: Record<string, ShopTier> = {
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
  starter: 'Starter AI',
  growth: 'Growth AI',
  business: 'Business AI',
};

const TIER_RANK: Record<ShopTier, number> = {
  starter: 0,
  growth: 1,
  business: 2,
};

export function tierAllowsFeature(tier: ShopTier, feature: string): boolean {
  const required = FEATURE_TIERS[feature];
  if (!required) return true;
  return (TIER_RANK[tier] ?? 0) >= TIER_RANK[required];
}

export function getRequiredTier(feature: string): ShopTier | undefined {
  return FEATURE_TIERS[feature];
}
