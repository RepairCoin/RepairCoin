import { TierConfig } from "../types";

export const TIER_CONFIG: Record<string, TierConfig> = {
  bronze: {
    color: "#CD7F32",
    bgColor: "bg-amber-900/30",
    icon: "medal-outline",
    bonus: 0,
  },
  silver: {
    color: "#C0C0C0",
    bgColor: "bg-gray-500/30",
    icon: "medal-outline",
    bonus: 2,
  },
  gold: {
    color: "#FFD700",
    bgColor: "bg-yellow-500/30",
    icon: "medal-outline",
    bonus: 5,
  },
};

export const REWARD_RATE = 10; // 1 RCN per $10 spent
export const COPY_FEEDBACK_DURATION = 1500;
export const DEFAULT_TRENDING_LIMIT = 6;
export const DEFAULT_TRENDING_DAYS = 7;

export { SERVICE_STATUS_OPTIONS } from "./SERVICE_STATUS_OPTIONS";
