import { useShop } from "@/hooks/shop/useShop";

/**
 * Hook for fetching shop profile by wallet address
 */
export const useShopProfileByWalletQuery = (walletAddress: string) => {
  const { useGetShopByWalletAddress } = useShop();
  return useGetShopByWalletAddress(walletAddress);
};
