import { BookingStatus } from "@/feature/services/booking/services/booking.interfaces";
import { getBookingStatusColor } from "@/shared/constants/booking-colors";

export function getStatusColor(status: BookingStatus | "approved"): string {
  return getBookingStatusColor(status);
}
