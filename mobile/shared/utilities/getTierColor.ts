import type { CustomerTierLower } from "@/feature/role/customer/profile/services/customer.interface";
import { TIER_COLORS, DEFAULT_TIER } from "@/shared/constants/customerProfile";

/**
 * Get tier color based on customer tier
 */
export const getTierColor = (tier?: string): string => {
  if (!tier) return TIER_COLORS[DEFAULT_TIER];
  const normalized = tier.toLowerCase() as CustomerTierLower;
  return TIER_COLORS[normalized] || TIER_COLORS[DEFAULT_TIER];
};
