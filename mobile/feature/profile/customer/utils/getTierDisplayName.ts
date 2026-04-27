import { CustomerTier } from "../types";

/**
 * Get tier display name with proper capitalization
 */
export const getTierDisplayName = (tier?: CustomerTier | string): string => {
  if (!tier) return "Bronze";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
};
