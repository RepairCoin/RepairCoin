import { useCallback } from "react";
import { useShopPromoCodesQuery, useUpdatePromoCodeStatusMutation } from "./useShopQuery";

export function usePromoCodeUI() {
  const { data: promoCodes, isLoading, error, refetch } = useShopPromoCodesQuery();
  const updateStatusMutation = useUpdatePromoCodeStatusMutation();

  const togglePromoCodeStatus = useCallback(
    (promoCodeId: string, isActive: boolean) => {
      updateStatusMutation.mutate({ promoCodeId, isActive });
    },
    [updateStatusMutation]
  );

  return {
    promoCodes: promoCodes || [],
    isLoading,
    error,
    refetch,
    isUpdating: updateStatusMutation.isPending,
    togglePromoCodeStatus,
  };
}
