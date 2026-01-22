import { CustomerServiceTab, BookingFilterTab, BookingStatusFilter } from "../types";
import { FilterOption } from "@/components/shared/FilterModal";

export const CUSTOMER_SERVICE_TABS: CustomerServiceTab[] = ["Services", "Favorites", "Bookings"];

export const TIME_FILTERS: FilterOption[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

export const STATUS_FILTERS: FilterOption[] = [
  { key: "all", label: "All Status", color: "#FFCC00" },
  { key: "pending", label: "Pending", color: "#EAB308" },
  { key: "paid", label: "Paid", color: "#3B82F6" },
  { key: "approved", label: "Approved", color: "#10B981" },
  { key: "completed", label: "Completed", color: "#22C55E" },
  { key: "cancelled", label: "Cancelled", color: "#EF4444" },
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
  pending: {
    bgColor: "bg-yellow-500/20",
    textColor: "text-yellow-500",
    icon: "time-outline" as const,
    color: "#EAB308",
  },
  paid: {
    bgColor: "bg-blue-500/20",
    textColor: "text-blue-500",
    icon: "checkmark-circle-outline" as const,
    color: "#3B82F6",
  },
  confirmed: {
    bgColor: "bg-blue-500/20",
    textColor: "text-blue-500",
    icon: "checkmark-circle-outline" as const,
    color: "#3B82F6",
  },
  approved: {
    bgColor: "bg-emerald-500/20",
    textColor: "text-emerald-500",
    icon: "shield-checkmark-outline" as const,
    color: "#10B981",
  },
  completed: {
    bgColor: "bg-green-500/20",
    textColor: "text-green-500",
    icon: "checkmark-done-outline" as const,
    color: "#22C55E",
  },
  cancelled: {
    bgColor: "bg-red-500/20",
    textColor: "text-red-500",
    icon: "close-circle-outline" as const,
    color: "#EF4444",
  },
  default: {
    bgColor: "bg-gray-500/20",
    textColor: "text-gray-500",
    icon: "ellipse-outline" as const,
    color: "#6B7280",
  },
};

export const getStatusConfig = (status: string) => {
  const key = status.toLowerCase() as keyof typeof STATUS_CONFIG;
  return STATUS_CONFIG[key] || STATUS_CONFIG.default;
};
