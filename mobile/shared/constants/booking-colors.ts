export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: "#FFCC00",
  paid: "#3b82f6",
  approved: "#3b82f6",
  scheduled: "#3b82f6",
  in_progress: "#a855f7",
  completed: "#22c55e",
  cancelled: "#ef4444",
  expired: "#6b7280",
  no_show: "#f97316",
  refunded: "#a855f7",
};

export const BOOKING_STATUS_LEGEND = [
  { label: "Approved", color: "#3b82f6" },
  { label: "Completed", color: "#22c55e" },
  { label: "Cancelled", color: "#ef4444" },
  { label: "Expired", color: "#6b7280" },
];

export function getBookingStatusColor(status: string): string {
  return BOOKING_STATUS_COLORS[status] || "#666";
}
