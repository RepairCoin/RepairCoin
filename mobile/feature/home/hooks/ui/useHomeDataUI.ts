import { useCallback } from "react";
import { useShopByWalletQuery, useShopCustomerGrowthQuery } from "../queries/useShopQueries";

export function useHomeDataUI() {
  const {
    data: shopData,
    isLoading: isShopLoading,
    error: shopError,
    refetch: refetchShop,
  } = useShopByWalletQuery();

  const {
    data: growthData,
    isLoading: isGrowthLoading,
    error: growthError,
    refetch: refetchGrowth,
  } = useShopCustomerGrowthQuery();

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
