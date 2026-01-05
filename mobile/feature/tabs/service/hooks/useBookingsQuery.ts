import { useMemo } from "react";
import { useShopBookingQuery } from "@/feature/booking/hooks";
import { BookingData, BookingStatus } from "@/interfaces/booking.interfaces";

export type BookingFilterStatus = "all" | BookingStatus;

export function useBookingsQuery(statusFilter: BookingFilterStatus) {
  const { data: bookingsData, isLoading, error, refetch } = useShopBookingQuery();

  // Filter bookings by status
  const filteredBookings = useMemo(() => {
    if (!bookingsData) return [];
    if (statusFilter === "all") return bookingsData;
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
