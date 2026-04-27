import { CustomerServiceTab, BookingFilterTab, BookingStatusFilter } from "../tab-types";
import { FilterOption } from "@/shared/components/shared/FilterModal";

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

// Date range constants for bookings
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

// Status color configuration
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
