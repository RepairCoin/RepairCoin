import { CustomerTierLower } from "@/shared/interfaces/customer.interface";

// Customer Tier Colors
export const TIER_COLORS: Record<CustomerTierLower, string> = {
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
};

// Default tier
export const DEFAULT_TIER: CustomerTierLower = "bronze";
