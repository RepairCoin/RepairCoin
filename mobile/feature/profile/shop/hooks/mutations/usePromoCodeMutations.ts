import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { queryClient, queryKeys } from "@/shared/config/queryClient";
import { promoCodeApi } from "../../services/promocode.services";
import { CreatePromoCodeRequest } from "@/shared/interfaces/shop.interface";

export function useUpdatePromoCodeStatusMutation() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId) || "";

  return useMutation({
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.shopPromoCodes(shopId),
      });
    },
  });
}

export function useCreatePromoCodeMutation() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (promoCodeData: CreatePromoCodeRequest) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return promoCodeApi.createPromoCode(shopId, promoCodeData);
    },
    onSuccess: () => {
      showSuccess("Promo code created successfully!");
      router.back();

      // Invalidate promo codes list to refresh
      if (shopId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopPromoCodes(shopId),
        });
      }
    },
    onError: (error: any) => {
      console.error("Failed to create promo code:", error);
      showError(error.response?.data?.error || "Failed to create promo code");
    },
  });
}
