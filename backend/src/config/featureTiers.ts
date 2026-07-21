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

// Rollout-gated features: their tier enforcement sits behind an env flag so a feature that is CURRENTLY
// open to all tiers can be gated DARK first (flag off = no behavior change), then enforced deliberately
// once shops are notified. Same philosophy as ENFORCE_AI_AUTOREPLY_TIER. Maps feature → the env flag that
// must be 'true' to actually enforce its tier.
const ROLLOUT_GATED_FEATURES: Record<string, string> = {
  // AI Campaigns (Advanced) / the shared auto-message automation engine (T7.2 also reuses this engine).
  aiCampaignsAdvanced: 'ENFORCE_CAMPAIGN_AUTOMATION_TIER',
};

/** True when `feature` is rollout-gated AND its flag is not yet enforcing → the feature stays open to all. */
export function isTierEnforcementDeferred(feature: string): boolean {
  const flag = ROLLOUT_GATED_FEATURES[feature];
  return !!flag && process.env[flag] !== 'true';
}

/** tierAllowsFeature, but honors the rollout flag: a deferred feature is allowed for EVERY tier until its
 *  flag flips on. Use this everywhere access is DECIDED (route guards + the feature-access map) so the
 *  backend gate and the frontend UI stay consistent from one flag. */
export function effectiveTierAllows(tier: SubscriptionTier, feature: string): boolean {
  if (isTierEnforcementDeferred(feature)) return true;
  return tierAllowsFeature(tier, feature);
}
