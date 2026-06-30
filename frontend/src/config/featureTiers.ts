export type ShopTier = 'starter' | 'growth' | 'business';

// Mirror of backend/src/config/featureTiers.ts. Minimum tier per gated feature;
// empty until features are gated. Any feature absent here is available on every tier.
export const FEATURE_TIERS: Record<string, ShopTier> = {
  inventoryManagement: 'growth',
  campaignBuilder: 'growth',
  advancedReports: 'growth',
  teamManagement: 'business',
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
