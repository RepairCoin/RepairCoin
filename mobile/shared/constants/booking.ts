import { BookingFilterStatus } from "@/feature/services/booking/types";
export { DAYS, MONTHS, YEARS } from "@/shared/utilities/calendar";

export const BOOKING_STATUS_FILTERS: {
  label: string;
  value: BookingFilterStatus;
}[] = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
];

export type BookingServiceTab = "Services" | "Booking";

export const BOOKING_SERVICE_TABS: BookingServiceTab[] = ["Services", "Booking"];

export const DEFAULT_SUBSCRIPTION_AMOUNT = "500.00";
export const SUBSCRIPTION_PERIOD_DAYS = 30;
