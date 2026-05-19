import { BookingStatus } from "@/feature/services/services/service.interface";
import { getBookingStatusColor } from "@/shared/constants/booking-colors";

export function getStatusColor(status: BookingStatus | "approved"): string {
  return getBookingStatusColor(status);
}
