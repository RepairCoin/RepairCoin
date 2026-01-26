import { useShop } from "@/shared/shop/useShop";

/**
 * Hook for fetching shop profile by ID
 */
export const useShopProfileQuery = (shopId: string) => {
  const { useGetShopById } = useShop();
  return useGetShopById(shopId);
};
