import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookingData } from "@/shared/interfaces/booking.interfaces";
import { CalendarBooking } from "@/shared/interfaces/appointment.interface";
import { BookingFilterStatus } from "../../types";
import { appointmentApi } from "@/feature/appointment/services/appointment.services";
import { queryKeys } from "@/shared/config/queryClient";

// Get date range for the current month (with padding for calendar view)
function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

// Map CalendarBooking to BookingData for component compatibility
function mapToBookingData(booking: CalendarBooking): BookingData {
  return {
    orderId: booking.orderId,
    shopId: booking.shopId,
    serviceId: booking.serviceId,
    serviceName: booking.serviceName,
    serviceDescription: null,
    serviceCategory: "",
    serviceDuration: 0,
    serviceImageUrl: null,
    customerAddress: booking.customerAddress,
    customerName: booking.customerName,
    status: booking.status as BookingData["status"],
    totalAmount: booking.totalAmount,
    rcnEarned: 0,
    stripePaymentIntentId: null,
    notes: booking.notes,
    bookingDate: booking.bookingDate,
    completedAt: null,
    createdAt: booking.createdAt,
    updatedAt: booking.createdAt,
    shopApproved: booking.status === "paid" || booking.status === "completed",
  };
}

export function useBookingsData(statusFilter: BookingFilterStatus) {
  const [currentMonth] = useState(new Date());
  const { startDate, endDate } = getMonthRange(currentMonth);

  const { data: calendarData, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.shopCalendar(startDate, endDate),
    queryFn: async () => {
      const response = await appointmentApi.getShopCalendar(startDate, endDate);
      return response.data as CalendarBooking[];
    },
    staleTime: 30 * 1000,
  });

  // Map to BookingData format
  const bookingsData = useMemo(() => {
    if (!calendarData) return [];
    return calendarData.map(mapToBookingData);
  }, [calendarData]);

  // Filter bookings by status
  const filteredBookings = useMemo(() => {
    if (!bookingsData.length) return [];
    if (statusFilter === "all") return bookingsData;

    // Special handling for "approved" - paid + shopApproved
    if (statusFilter === "approved") {
      return bookingsData.filter(
        (booking) => booking.status === "paid" && booking.shopApproved === true
      );
    }

    // For "paid" filter, only show bookings that are NOT yet approved
    if (statusFilter === "paid") {
      return bookingsData.filter(
        (booking) => booking.status === "paid" && !booking.shopApproved
      );
    }

    return bookingsData.filter((booking) => booking.status === statusFilter);
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
