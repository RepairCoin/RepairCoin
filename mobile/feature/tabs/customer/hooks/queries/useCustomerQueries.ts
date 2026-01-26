import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { shopApi } from "@/shared/services/shop.services";
import { useAuthStore } from "@/shared/store/auth.store";

export function useShopCustomersQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  return useQuery({
    queryKey: queryKeys.shopCustomers(shopId),
    queryFn: async () => {
      const response = await shopApi.getShopCustomers(shopId);
      return response?.data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000,
  });
}
