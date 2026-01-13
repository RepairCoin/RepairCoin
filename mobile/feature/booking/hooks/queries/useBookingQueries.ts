import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { BookingFilters, BookingResponse } from "@/interfaces/booking.interfaces";
import { bookingApi } from "@/services/booking.services";

export function useShopBookingQuery(filters?: BookingFilters) {
  return useQuery({
    queryKey: queryKeys.shopBookings(filters),
    queryFn: async () => {
      const response: BookingResponse = await bookingApi.getShopBookings(filters);
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds - refresh more frequently for booking status updates
  });
}

export function useCustomerBookingQuery(filters?: BookingFilters) {
  return useQuery({
    queryKey: queryKeys.customerBookings(filters),
    queryFn: async () => {
      const response: BookingResponse = await bookingApi.getCustomerBookings(filters);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
