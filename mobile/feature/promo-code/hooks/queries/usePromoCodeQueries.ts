import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "@/config/queryClient";
import { promoCodeApi } from "@/services/promocode.services";
import { PromoCodesListResponse } from "@/interfaces/shop.interface";

export function useShopPromoCodesQuery() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId) || "";

  return useQuery({
    queryKey: queryKeys.shopPromoCodes(shopId),
    queryFn: async () => {
      const response: PromoCodesListResponse = await promoCodeApi.getPromoCodes(shopId);
      return response.items || [];
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
