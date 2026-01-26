import { useMemo } from "react";
import { BookingData } from "@/interfaces/booking.interfaces";
import { BookingFilterStatus } from "../../types";
import { useShopBookingQuery } from "@/shared/booking/useBooking";

export function useBookingsData(statusFilter: BookingFilterStatus) {
  const { data: bookingsData, isLoading, error, refetch } = useShopBookingQuery();

  // Filter bookings by status
  const filteredBookings = useMemo(() => {
    if (!bookingsData) return [];
    if (statusFilter === "all") return bookingsData;

    // Special handling for "approved" - paid + shopApproved
    if (statusFilter === "approved") {
      return bookingsData.filter(
        (booking: BookingData) => booking.status === "paid" && booking.shopApproved === true
      );
    }

    // For "paid" filter, only show bookings that are NOT yet approved
    if (statusFilter === "paid") {
      return bookingsData.filter(
        (booking: BookingData) => booking.status === "paid" && !booking.shopApproved
      );
    }

    return bookingsData.filter(
      (booking: BookingData) => booking.status === statusFilter
    );
  }, [bookingsData, statusFilter]);

  // Get bookings for a specific date
  const getBookingsForDate = (date: Date): BookingData[] => {
    return filteredBookings.filter((booking) => {
      const bookingDate = booking.bookingDate
        ? new Date(booking.bookingDate)
        : new Date(booking.createdAt);
      return (
        bookingDate.getFullYear() === date.getFullYear() &&
        bookingDate.getMonth() === date.getMonth() &&
        bookingDate.getDate() === date.getDate()
      );
    });
  };

  return {
    bookings: filteredBookings,
    isLoading,
    error,
    refetch,
    getBookingsForDate,
  };
}
