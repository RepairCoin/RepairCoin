export interface TierConfig {
  color: string;
  bgColor: string;
  icon: string;
  bonus: number;
}

export interface TierInfo {
  tier: string;
  color: string;
  bgColor: string;
  icon: string;
  bonus: number;
  tierBonus: number;
}

export interface RewardCalculation {
  base: number;
  bonus: number;
  total: number;
}

export interface ServiceParams {
  id: string;
}

export interface TrendingParams {
  limit?: number;
  days?: number;
}
