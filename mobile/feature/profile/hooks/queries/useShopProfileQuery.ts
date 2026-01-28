import { useShop } from "@/shared/hooks/shop/useShop";

/**
 * Hook for fetching shop profile by ID
 */
export const useShopProfileQuery = (shopId: string) => {
  const { useGetShopById } = useShop();
  return useGetShopById(shopId);
};
