import { bookingApi } from "@/services/booking.services";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { BookingFilters, BookingResponse } from "@/interfaces/booking.interfaces";

export function useBooking() {
  const useShopBookingQuery = (
    filters?: BookingFilters
  ) => {
    return useQuery({
      queryKey: queryKeys.bookings(filters),
      queryFn: async () => {
        const response: BookingResponse = await bookingApi.getShopBookings(filters);
        return response.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useCustomerBookingQuery = (
    filters?: BookingFilters
  ) => {
    return useQuery({
      queryKey: queryKeys.bookings(filters),
      queryFn: async () => {
        const response: BookingResponse = await bookingApi.getCustomerBookings(filters);
        return response.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  return { useShopBookingQuery, useCustomerBookingQuery };
}
