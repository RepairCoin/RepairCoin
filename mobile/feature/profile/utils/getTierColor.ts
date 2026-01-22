import { CustomerTier } from "../types";
import { TIER_COLORS, DEFAULT_TIER } from "../constants";

/**
 * Get tier color based on customer tier
 */
export const getTierColor = (tier?: CustomerTier | string): string => {
  if (!tier) return TIER_COLORS[DEFAULT_TIER];
  return TIER_COLORS[tier as CustomerTier] || TIER_COLORS[DEFAULT_TIER];
};
