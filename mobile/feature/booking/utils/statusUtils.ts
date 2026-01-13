import { BookingStatus } from "@/interfaces/booking.interfaces";

export function getStatusColor(status: BookingStatus): string {
  switch (status) {
    case "completed":
      return "#22c55e";
    case "paid":
      return "#3b82f6";
    case "pending":
      return "#eab308";
    case "cancelled":
      return "#ef4444";
    default:
      return "#666";
  }
}
