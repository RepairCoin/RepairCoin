import { BookingFilterStatus } from "../types";

export const BOOKING_STATUS_FILTERS: {
  label: string;
  value: BookingFilterStatus;
}[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Approved", value: "approved" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
];
