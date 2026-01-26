import { useShop } from "@/shared/shop/useShop";

/**
 * Hook for updating shop profile
 */
export const useUpdateShopProfileMutation = (walletAddress: string) => {
  const { useUpdateShop } = useShop();
  return useUpdateShop(walletAddress);
};
