import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookingData } from "@/shared/interfaces/booking.interfaces";
import { BookingFilterStatus } from "../../types";
import { bookingApi } from "../../services/booking.services";

export function useBookingsData(statusFilter: BookingFilterStatus) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["shopBookings"],
    queryFn: async () => {
      const response = await bookingApi.getShopBookings();
      return (response.data ?? response.items ?? []) as BookingData[];
    },
    staleTime: 30 * 1000,
  });

  const bookingsData = data ?? [];

  // Filter bookings by status
  const filteredBookings = useMemo(() => {
    if (!bookingsData.length) return [];
    if (statusFilter === "all") return bookingsData;

    // "approved" = paid + shopApproved (all paid orders are auto-approved)
    if (statusFilter === "approved") {
      return bookingsData.filter(
        (booking) => booking.status === "paid" && booking.shopApproved === true
      );
    }

    return bookingsData.filter((booking) => booking.status === statusFilter);
  }, [bookingsData, statusFilter]);

  const isSameDay = (booking: BookingData, date: Date): boolean => {
    const bookingDate = booking.bookingDate
      ? new Date(booking.bookingDate)
      : new Date(booking.createdAt);
    return (
      bookingDate.getFullYear() === date.getFullYear() &&
      bookingDate.getMonth() === date.getMonth() &&
      bookingDate.getDate() === date.getDate()
    );
  };

  // Bookings for a date, filtered by the active status filter — used by the
  // list of bookings shown under the selected date.
  const getBookingsForDate = (date: Date): BookingData[] => {
    return filteredBookings.filter((booking) => isSameDay(booking, date));
  };

  // Bookings for a date across ALL statuses — used by calendar dots so the
  // status filter only affects the list below, not the calendar itself.
  const getAllBookingsForDate = (date: Date): BookingData[] => {
    return bookingsData.filter((booking) => isSameDay(booking, date));
  };

  return {
    bookings: filteredBookings,
    isLoading,
    error,
    refetch,
    getBookingsForDate,
    getAllBookingsForDate,
  };
}
