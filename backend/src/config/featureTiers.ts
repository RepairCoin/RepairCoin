import { SubscriptionTier, PaidTier } from './subscriptionPlans';

// Minimum tier required for a gated feature. Empty until features are gated;
// any feature absent here is ungated (available on every tier) — including on
// 'free'. Keep in sync with frontend/src/config/featureTiers.ts.
export const FEATURE_TIERS: Record<string, PaidTier> = {
  // Growth (also available on Business — cumulative). Decisions locked 2026-07-14.
  inventoryManagement: 'growth',
  campaignBuilder: 'growth',
  advancedReports: 'growth',
  aiImageGen: 'growth',        // AI Image & Content Generator (admin "AI Images" toggle)
  aiLeadFollowUp: 'growth',    // AI Lead Follow-Up (admin "Follow-up Nudges" toggle)
  campaignRewards: 'growth',   // Campaign Rewards (admin "Campaign Rewards" toggle)
  voiceAiAssistant: 'growth',
  aiMarketingSuite: 'growth',
  aiInsights: 'growth',        // AI Insights & Business Intelligence
  // Business-only.
  teamManagement: 'business',
  multiLocation: 'business',
  aiMemory: 'business',        // Advanced AI Memory & Automation
  aiAutoReplies: 'business',   // AI Auto-Replies (Voice + Text)
  aiCampaignsAdvanced: 'business',
  advancedInventory: 'business',
  // NOTE: the AI Sales Agent master on/off (ai_global_enabled) is Starter+ = intentionally NOT gated.
};

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  business: 3,
};

export function tierAllowsFeature(tier: SubscriptionTier, feature: string): boolean {
  const required = FEATURE_TIERS[feature];
  if (!required) return true;
  // An unrecognised tier falls to rank 0 = 'free', the most restrictive.
  return (TIER_RANK[tier] ?? 0) >= TIER_RANK[required];
}

// Always a paid tier: 'free' is never a *requirement*, only a resolved state.
export function getRequiredTier(feature: string): PaidTier | undefined {
  return FEATURE_TIERS[feature];
}
