import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryClient, queryKeys } from "@/config/queryClient";
import { promoCodeApi, PromoCode } from "../services";

/**
 * Hook for managing promo codes in shop home
 */
export function usePromoCode() {
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      promoCodeId,
      isActive,
    }: {
      promoCodeId: string;
      isActive: boolean;
    }) => {
      return promoCodeApi.updateStatus(shopId, promoCodeId, isActive);
    },
    onSuccess: () => {
      // Invalidate promo codes query to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.shopPromoCodes(shopId),
      });
    },
  });

  const togglePromoCodeStatus = (promoCodeId: string, isActive: boolean) => {
    updateStatusMutation.mutate({ promoCodeId, isActive });
  };

  return {
    promoCodes: (promoCodesData || []) as PromoCode[],
    isLoading,
    isUpdating: updateStatusMutation.isPending,
    error,
    refetch,
    togglePromoCodeStatus,
  };
}
