// Shared utility functions for tier calculations and analytics

export interface TierBonusStats {
  totalBonusesIssued: number;
  totalBonusAmount: number;
  bonusesByTier: { [key: string]: { count: number; amount: number } };
  averageBonusPerTransaction: number;
}

export interface TierInfo {
  name: string;
  displayName: string;
  icon: string;
  bonusAmount: number;
  color: string;
  gradientClass: string;
  bgClass: string;
}

export const TIER_CONFIG: { [key: string]: TierInfo } = {
  BRONZE: {
    name: 'BRONZE',
    displayName: 'Bronze',
    icon: '🥉',
    bonusAmount: 10,
    color: 'orange',
    gradientClass: 'from-orange-500 to-orange-600',
    bgClass: 'bg-orange-500'
  },
  SILVER: {
    name: 'SILVER',
    displayName: 'Silver',
    icon: '🥈',
    bonusAmount: 20,
    color: 'gray',
    gradientClass: 'from-gray-400 to-gray-500',
    bgClass: 'bg-gray-500'
  },
  GOLD: {
    name: 'GOLD',
    displayName: 'Gold',
    icon: '🥇',
    bonusAmount: 30,
    color: 'yellow',
    gradientClass: 'from-yellow-500 to-yellow-600',
    bgClass: 'bg-yellow-500'
  }
};

export interface TierDistribution {
  name: string;
  displayName: string;
  icon: string;
  percentage: number;
  count: number;
  amount: number;
  color: string;
  gradientClass: string;
  bgClass: string;
  bonusAmount: number;
}

export function calculateTierDistribution(tierStats: TierBonusStats | null): TierDistribution[] {
  if (!tierStats || !tierStats.bonusesByTier) {
    return Object.values(TIER_CONFIG).map(config => ({
      ...config,
      percentage: 0,
      count: 0,
      amount: 0
    }));
  }

  const total = tierStats.totalBonusesIssued || 0;
  
  return Object.entries(TIER_CONFIG).map(([tierKey, config]) => {
    const tierData = tierStats.bonusesByTier[tierKey] || { count: 0, amount: 0 };
    const percentage = total > 0 ? (tierData.count / total) * 100 : 0;
    
    return {
      ...config,
      percentage,
      count: tierData.count,
      amount: tierData.amount
    };
  });
}

export function calculateBonusesAvailable(
  shopBalance: number, 
  tierStats: TierBonusStats | null
): number {
  // Calculate average bonus amount from tier stats or use default
  const avgBonusAmount = tierStats && tierStats.totalBonusesIssued > 0 
    ? Math.round(tierStats.totalBonusAmount / tierStats.totalBonusesIssued)
    : 20; // Default to Silver tier bonus
    
  return Math.floor(shopBalance / avgBonusAmount);
}

export function getAverageBonusAmount(tierStats: TierBonusStats | null): number {
  if (tierStats && tierStats.totalBonusesIssued > 0) {
    return Math.round(tierStats.totalBonusAmount / tierStats.totalBonusesIssued);
  }
  // Default to average of all tier bonuses
  const bonuses = Object.values(TIER_CONFIG).map(t => t.bonusAmount);
  return Math.round(bonuses.reduce((a, b) => a + b, 0) / bonuses.length);
}

export function formatRCN(amount: number): string {
  return `${amount.toLocaleString()} RCN`;
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}