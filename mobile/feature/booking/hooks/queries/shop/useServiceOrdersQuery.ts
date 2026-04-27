import { useQuery } from "@tanstack/react-query";
import { bookingApi } from "../../../services/booking.services";

export function useServiceOrdersQuery() {
  return useQuery({
    queryKey: ["repaircoin", "serviceOrders"],
    queryFn: async () => {
      const response = await bookingApi.getShopBookings({ limit: 500 });
      return response.data || response.items || [];
    },
    staleTime: 30 * 1000,
  });
}
