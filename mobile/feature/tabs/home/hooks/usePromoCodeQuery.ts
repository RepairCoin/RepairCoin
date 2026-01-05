import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "@/config/queryClient";
import { PromoCodeData } from "@/interfaces/shop.interface";
import { promoCodeApi } from "@/services/promocode.services";

export function usePromoCodeQuery() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId) || "";

  const {
    data: promoCodesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.shopPromoCodes(shopId),
    queryFn: async () => {
      const response = await promoCodeApi.getPromoCodes(shopId);
      return response.data;
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    promoCodes: (promoCodesData || []) as PromoCodeData[],
    isLoading,
    error,
    refetch,
  };
}
