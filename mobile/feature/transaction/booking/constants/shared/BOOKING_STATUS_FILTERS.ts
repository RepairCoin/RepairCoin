import { BookingFilterStatus } from "../../types";

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
