import { CustomerTier } from "../types";

export const TIER_STYLES: Record<CustomerTier, string> = {
  GOLD: "bg-gradient-to-r from-yellow-500 to-yellow-600",
  SILVER: "bg-gradient-to-r from-gray-400 to-gray-500",
  BRONZE: "bg-gradient-to-r from-orange-500 to-orange-600",
};
