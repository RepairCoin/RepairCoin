import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { BookingFilters, BookingResponse } from "@/interfaces/booking.interfaces";
import { bookingApi } from "@/services/booking.services";

interface QueryOptions {
  enabled?: boolean;
}

export function useShopBookingQuery(filters?: BookingFilters, options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.shopBookings(filters),
    queryFn: async () => {
      const response: BookingResponse = await bookingApi.getShopBookings(filters);
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds - refresh more frequently for booking status updates
    enabled: options?.enabled ?? true,
  });
}

export function useCustomerBookingQuery(filters?: BookingFilters, options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.customerBookings(filters),
    queryFn: async () => {
      const response: BookingResponse = await bookingApi.getCustomerBookings(filters);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}
