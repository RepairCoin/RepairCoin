import { useQuery } from "@tanstack/react-query";
import { getShopServices } from "@/services/ShopServices";
import { useAuthStore } from "@/store/authStore";
import { ServiceResponse } from "@/services/ShopServices";

export const useShopServices = (options?: { page?: number; limit?: number }) => {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;
  
  return useQuery({
    queryKey: ["shopServices", shopId, options],
    queryFn: async () => {
      const response: ServiceResponse = await getShopServices(shopId!, options);
      return response.data;
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};