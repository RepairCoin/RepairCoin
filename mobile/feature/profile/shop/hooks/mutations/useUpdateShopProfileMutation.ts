import { useShop } from "@/feature/profile/shop/hooks/useShop";

/**
 * Hook for updating shop profile
 */
export const useUpdateShopProfileMutation = (walletAddress: string) => {
  const { useUpdateShop } = useShop();
  return useUpdateShop(walletAddress);
};
