import { useQuery } from "@tanstack/react-query";
import { appointmentApi, CustomerSearchResult } from "@/shared/services/appointment.services";

/**
 * Hook to search customers for manual booking
 */
export function useCustomerSearchQuery(
  shopId: string | undefined,
  query: string,
  options?: { enabled?: boolean }
) {
  return useQuery<CustomerSearchResult[]>({
    queryKey: ["repaircoin", "customer-search", shopId, query],
    queryFn: () => appointmentApi.searchCustomers(shopId!, query),
    staleTime: 30 * 1000, // 30 seconds
    enabled: options?.enabled !== false && !!shopId && query.length >= 2,
  });
}
