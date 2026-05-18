import { TierConfig } from "@/feature/services/types";
import { CustomerServiceTab } from "@/feature/services/tab-types";
import { FilterOption } from "@/shared/components/shared/FilterModal";
import { AvailabilityTab, ServiceStatusFilter, ServiceFormData } from "@/feature/services/types";

// Tier configuration for service detail
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

// Review/Rating constants
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
export const SERVICE_STATUS_OPTIONS: ServiceStatusFilter[] = ["all", "active", "inactive"];

export const AVAILABILITY_TABS: { label: string; value: AvailabilityTab }[] = [
  { label: "Hours", value: "hours" },
  { label: "Settings", value: "settings" },
  { label: "Overrides", value: "overrides" },
];

export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return {
    value: `${hour.toString().padStart(2, "0")}:${minute}`,
    label: `${displayHour}:${minute} ${period}`,
  };
});

export const INITIAL_FORM_DATA: ServiceFormData = {
  serviceName: "",
  category: "repairs",
  description: "",
  priceUsd: "",
  imageUrl: "",
  tags: "",
  active: true,
};

export type ServiceTab = "Services" | "Booking" | "Analytics";
export const SERVICE_TABS: ServiceTab[] = ["Services", "Booking", "Analytics"];

// Shared day constants
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const FULL_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Customer constants
export const CUSTOMER_SERVICE_TABS: CustomerServiceTab[] = ["Services", "Favorites", "Bookings"];

export const TIME_FILTERS: FilterOption[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

export const STATUS_FILTERS: FilterOption[] = [
  { key: "all", label: "All Status", color: "#FFCC00" },
  { key: "paid", label: "Approved", color: "#3B82F6" },
  { key: "completed", label: "Completed", color: "#22C55E" },
  { key: "cancelled", label: "Cancelled", color: "#EF4444" },
  { key: "no_show", label: "No Show", color: "#F97316" },
  { key: "expired", label: "Expired", color: "#6B7280" },
];

export const BOOKING_DATE_RANGE = {
  DAYS_PAST: 30,
  DAYS_FUTURE: 90,
};

export const getBookingDateRange = () => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - BOOKING_DATE_RANGE.DAYS_PAST);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + BOOKING_DATE_RANGE.DAYS_FUTURE);
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
};

export const STATUS_CONFIG = {
  paid: {
    bgColor: "bg-blue-500/20",
    textColor: "text-blue-500",
    icon: "checkmark-circle-outline" as const,
    color: "#3B82F6",
    label: "Approved",
  },
  confirmed: {
    bgColor: "bg-blue-500/20",
    textColor: "text-blue-500",
    icon: "checkmark-circle-outline" as const,
    color: "#3B82F6",
    label: "Approved",
  },
  completed: {
    bgColor: "bg-green-500/20",
    textColor: "text-green-500",
    icon: "checkmark-done-outline" as const,
    color: "#22C55E",
    label: "Completed",
  },
  cancelled: {
    bgColor: "bg-red-500/20",
    textColor: "text-red-500",
    icon: "close-circle-outline" as const,
    color: "#EF4444",
    label: "Cancelled",
  },
  no_show: {
    bgColor: "bg-orange-500/20",
    textColor: "text-orange-500",
    icon: "alert-circle-outline" as const,
    color: "#F97316",
    label: "No Show",
  },
  expired: {
    bgColor: "bg-gray-500/20",
    textColor: "text-gray-500",
    icon: "time-outline" as const,
    color: "#6B7280",
    label: "Expired",
  },
  default: {
    bgColor: "bg-gray-500/20",
    textColor: "text-gray-500",
    icon: "ellipse-outline" as const,
    color: "#6B7280",
    label: "",
  },
};

export const getStatusConfig = (status: string) => {
  const key = status.toLowerCase() as keyof typeof STATUS_CONFIG;
  return STATUS_CONFIG[key] || STATUS_CONFIG.default;
};
