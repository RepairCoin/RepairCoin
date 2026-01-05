import { useQuery } from "@tanstack/react-query";
import { bookingApi } from "../services";
import { queryKeys } from "@/config/queryClient";
import { BookingFilters, BookingResponse } from "@/interfaces/booking.interfaces";

// Query: Get shop bookings
export function useShopBookingQuery(filters?: BookingFilters) {
  return useQuery({
    queryKey: queryKeys.shopBookings(filters),
    queryFn: async () => {
      const response: BookingResponse = await bookingApi.getShopBookings(filters);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query: Get customer bookings
export function useCustomerBookingQuery(filters?: BookingFilters) {
  return useQuery({
    queryKey: queryKeys.customerBookings(filters),
    queryFn: async () => {
      const response: BookingResponse = await bookingApi.getCustomerBookings(filters);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
