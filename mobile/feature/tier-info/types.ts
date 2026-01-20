import { Tier } from "@/utilities/GlobalTypes";

export interface TierConfig {
  color: [string, string];
  label: string;
  bonus: number;
  requirement: number;
  benefits: string[];
}

export interface TierProgress {
  currentTier: Tier;
  lifetimeEarnings: number;
  nextTier: Tier | null;
  nextTierConfig: TierConfig | null;
  progressToNextTier: number;
  rcnToNextTier: number;
}
