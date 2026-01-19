import { CustomerTier } from "../types";

// Customer Tier Colors
export const TIER_COLORS: Record<CustomerTier, string> = {
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
};

// Default tier
export const DEFAULT_TIER: CustomerTier = "bronze";
