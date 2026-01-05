import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryClient, queryKeys } from "@/config/queryClient";
import { promoCodeApi } from "@/services/promocode.services";

export function usePromoCodeMutation() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId) || "";

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
    isUpdating: updateStatusMutation.isPending,
    togglePromoCodeStatus,
  };
}
