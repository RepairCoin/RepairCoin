import { useShop } from "@/hooks/shop/useShop";

/**
 * Hook for updating shop profile
 */
export const useUpdateShopProfileMutation = (walletAddress: string) => {
  const { useUpdateShop } = useShop();
  return useUpdateShop(walletAddress);
};
