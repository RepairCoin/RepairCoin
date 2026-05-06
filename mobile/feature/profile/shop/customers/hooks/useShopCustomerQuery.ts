import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys } from "@/shared/config/queryClient";
import { shopCustomerApi } from "../services/shopCustomer.services";
import { customerApi } from "@/feature/profile/customer/services/customer.services";
import { transformCustomer } from "../../utils/transformCustomer";

export function useShopCustomerGrowthQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  return useQuery({
    queryKey: queryKeys.shopCustomerGrowth(shopId),
    queryFn: async () => {
      const response = await shopCustomerApi.getShopCustomerGrowth(shopId);
      return response?.data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useShopCustomersQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  return useQuery({
    queryKey: queryKeys.shopCustomers(shopId),
    queryFn: async () => {
      const response = await shopCustomerApi.getShopCustomers(shopId);
      const data = response?.data;

      // Transform customers to ensure camelCase properties
      if (data?.customers) {
        data.customers = data.customers.map(transformCustomer);
      }

      return data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useSearchAllCustomersQuery(searchQuery: string, enabled: boolean = false, page: number = 1) {
  return useQuery({
    queryKey: ["searchAllCustomers", searchQuery, page],
    queryFn: async () => {
      const response = await customerApi.searchAllCustomers(searchQuery, page, 20);
      const data = response?.data;

      // Transform customers to ensure camelCase properties
      if (data?.customers) {
        data.customers = data.customers.map(transformCustomer);
      }

      return data;
    },
    enabled: enabled && !!searchQuery.trim(),
    staleTime: 5 * 60 * 1000,
  });
}