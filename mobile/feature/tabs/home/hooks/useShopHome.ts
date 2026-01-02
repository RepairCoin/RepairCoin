import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "@/config/queryClient";
import { shopHomeApi } from "../services";

/**
 * Hook for fetching shop home data
 * Aggregates shop data and customer growth data for the home screen
 */
export function useShopHome() {
  const { account, userProfile } = useAuthStore();
  const walletAddress = account?.address || "";
  const shopId = userProfile?.shopId || "";

  const {
    data: shopData,
    isLoading: isShopLoading,
    error: shopError,
    refetch: refetchShop,
  } = useQuery({
    queryKey: queryKeys.shopByWalletAddress(walletAddress),
    queryFn: async () => {
      const response = await shopHomeApi.getShopByWalletAddress(walletAddress);
      return response.data;
    },
    enabled: !!walletAddress,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const {
    data: growthData,
    isLoading: isGrowthLoading,
    error: growthError,
    refetch: refetchGrowth,
  } = useQuery({
    queryKey: queryKeys.shopCustomerGrowth(shopId),
    queryFn: async () => {
      const response = await shopHomeApi.getCustomerGrowth(shopId);
      return response?.data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const refetch = useCallback(() => {
    refetchShop();
    refetchGrowth();
  }, [refetchShop, refetchGrowth]);

  return {
    shopData,
    growthData,
    isLoading: isShopLoading || isGrowthLoading,
    error: shopError || growthError,
    refetch,
  };
}
