import { BookingStatus } from "@/shared/interfaces/booking.interfaces";
import { getBookingStatusColor } from "@/shared/constants/booking-colors";

export function getStatusColor(status: BookingStatus | "approved"): string {
  return getBookingStatusColor(status);
}
