import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { purchaseApi } from "@/feature/buy-token/services/purchase.services";
import { useAuthStore } from "@/store/auth.store";

export function useShopTransactionsQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  return useQuery({
    queryKey: queryKeys.shopTransactions(shopId),
    queryFn: async () => {
      const response = await purchaseApi.getShopTransactions(shopId);
      return response?.data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000,
  });
}
