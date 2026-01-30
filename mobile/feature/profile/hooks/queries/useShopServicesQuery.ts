import { useService } from "@/shared/hooks/service/useService";

/**
 * Hook for fetching shop services
 */
export const useShopServicesQuery = (shopId: string) => {
  const { useShopServicesQuery: useServices } = useService();
  return useServices({ shopId, page: 1, limit: 20 });
};
