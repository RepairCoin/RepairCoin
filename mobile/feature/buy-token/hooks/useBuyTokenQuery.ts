import { useShop } from "@/hooks/shop/useShop";
import { useAuthStore } from "@/store/auth.store";

export function useBuyTokenQuery() {
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();

  const { data: shopData, isLoading, error, refetch } = useGetShopByWalletAddress(
    account?.address || ""
  );

  // Check if shop is qualified to buy RCN
  const isQualified =
    shopData?.operational_status === "subscription_qualified" ||
    shopData?.operational_status === "rcg_qualified";

  return {
    shopData,
    isQualified,
    isLoading,
    error,
    refetch,
  };
}
