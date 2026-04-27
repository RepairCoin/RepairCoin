import { useShop } from "@/feature/profile/shop/hooks/useShop";

/**
 * Hook for fetching shop profile by wallet address
 */
export const useShopProfileByWalletQuery = (walletAddress: string) => {
  const { useGetShopByWalletAddress } = useShop();
  return useGetShopByWalletAddress(walletAddress);
};
