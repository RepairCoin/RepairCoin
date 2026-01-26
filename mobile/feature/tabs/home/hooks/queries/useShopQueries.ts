import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "@/config/queryClient";
import { shopApi } from "@/shared/services/shop.services";

export function useShopByWalletQuery() {
  const { account } = useAuthStore();
  const walletAddress = account?.address || "";

  return useQuery({
    queryKey: queryKeys.shopByWalletAddress(walletAddress),
    queryFn: async () => {
      const response = await shopApi.getShopByWalletAddress(walletAddress);
      return response.data;
    },
    enabled: !!walletAddress,
    staleTime: 10 * 60 * 1000,
  });
}

export function useShopCustomerGrowthQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  return useQuery({
    queryKey: queryKeys.shopCustomerGrowth(shopId),
    queryFn: async () => {
      const response = await shopApi.getCustomerGrowth(shopId);
      return response?.data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000,
  });
}
