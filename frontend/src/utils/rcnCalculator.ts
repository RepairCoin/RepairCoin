// frontend/src/utils/rcnCalculator.ts

export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD';

const TIER_BONUSES = {
  BRONZE: 0,
  SILVER: 2,
  GOLD: 5
} as const;

const MINIMUM_EARN_AMOUNT = 50;

/**
 * Calculate base RCN earned for a service based on price
 * $50-$99: 10 RCN
 * $100+: 25 RCN
 * Below $50: 0 RCN
 */
export function calculateBaseRcn(servicePrice: number): number {
  if (servicePrice >= 100) {
    return 25;
  } else if (servicePrice >= MINIMUM_EARN_AMOUNT) {
    return 10;
  } else {
    return 0;
  }
}

/**
 * Calculate tier bonus for a customer
 */
export function calculateTierBonus(tier: CustomerTier, servicePrice: number): number {
  if (servicePrice < MINIMUM_EARN_AMOUNT) {
    return 0;
  }
  return TIER_BONUSES[tier];
}

/**
 * Calculate total RCN a customer will earn from a service
 */
export function calculateTotalRcn(servicePrice: number, customerTier: CustomerTier = 'BRONZE'): {
  baseRcn: number;
  tierBonus: number;
  totalRcn: number;
  qualifies: boolean;
} {
  const baseRcn = calculateBaseRcn(servicePrice);
  const tierBonus = calculateTierBonus(customerTier, servicePrice);
  const totalRcn = baseRcn + tierBonus;
  const qualifies = servicePrice >= MINIMUM_EARN_AMOUNT;

  return {
    baseRcn,
    tierBonus,
    totalRcn,
    qualifies
  };
}

/**
 * Format RCN display text with tier information
 */
export function formatRcnEarning(servicePrice: number, customerTier: CustomerTier = 'BRONZE'): string {
  const { baseRcn, tierBonus, totalRcn, qualifies } = calculateTotalRcn(servicePrice, customerTier);

  if (!qualifies) {
    return 'Earn 10+ RCN with $50+ services';
  }

  if (tierBonus > 0) {
    return `Earn ${totalRcn} RCN (${baseRcn} + ${tierBonus} ${customerTier} bonus)`;
  }

  return `Earn ${totalRcn} RCN`;
}
