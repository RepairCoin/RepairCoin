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

// Review/Rating constants (merged from feature/ratings)
export const MAX_COMMENT_LENGTH = 500;
export const STAR_COUNT = 5;

export const RATING_LABELS: Record<number, string> = {
  0: "Tap to rate",
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

export const REVIEW_TIPS = [
  "Describe what made your experience good or bad",
  "Mention specific details about the service",
  "Be honest and constructive",
];

// Shop constants
export { SERVICE_STATUS_OPTIONS } from "./shop/SERVICE_STATUS_OPTIONS";
export { AVAILABILITY_TABS } from "./shop/AVAILABILITY_TABS";
export { TIME_OPTIONS } from "./shop/TIME_OPTIONS";
export { INITIAL_FORM_DATA } from "./shop/INITIAL_FORM_DATA";
export { SERVICE_TABS } from "./shop/SERVICE_TABS";
export type { ServiceTab } from "./shop/SERVICE_TABS";

// Shared constants
export { DAYS, FULL_DAYS } from "./shared/DAYS";

// Customer constants
export {
  CUSTOMER_SERVICE_TABS,
  TIME_FILTERS,
  STATUS_FILTERS,
  BOOKING_DATE_RANGE,
  getBookingDateRange,
  STATUS_CONFIG,
  getStatusConfig,
} from "./customer/CUSTOMER_SERVICE_TABS";
