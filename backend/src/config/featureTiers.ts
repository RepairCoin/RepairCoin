import { SubscriptionTier } from './subscriptionPlans';

// Minimum tier required for a gated feature. Empty until features are gated;
// any feature absent here is ungated (available on every tier). Keep in sync
// with frontend/src/config/featureTiers.ts.
export const FEATURE_TIERS: Record<string, SubscriptionTier> = {
  inventoryManagement: 'growth',
  campaignBuilder: 'growth',
  advancedReports: 'growth',
  teamManagement: 'business',
  multiLocation: 'business',
};

const TIER_RANK: Record<SubscriptionTier, number> = {
  starter: 0,
  growth: 1,
  business: 2,
};

export function tierAllowsFeature(tier: SubscriptionTier, feature: string): boolean {
  const required = FEATURE_TIERS[feature];
  if (!required) return true;
  return (TIER_RANK[tier] ?? 0) >= TIER_RANK[required];
}

export function getRequiredTier(feature: string): SubscriptionTier | undefined {
  return FEATURE_TIERS[feature];
}
