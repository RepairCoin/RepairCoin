import { BookingStatus } from "@/shared/interfaces/booking.interfaces";

export function getStatusColor(status: BookingStatus | "approved"): string {
  switch (status) {
    case "completed":
      return "#22c55e"; // Green for success
    case "approved":
      return "#22c55e"; // Green for approved
    case "in_progress":
      return "#22c55e"; // Green for in progress
    case "paid":
      return "#FFCC00"; // Yellow for paid (awaiting approval)
    case "pending":
      return "#FFCC00"; // Yellow for pending
    case "cancelled":
      return "#ef4444"; // Red for cancelled
    default:
      return "#666";
  }
}
