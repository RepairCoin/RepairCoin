import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { queryClient, queryKeys } from "@/shared/config/queryClient";
import { CreatePromoCodeRequest, PromoCodesListResponse } from "@/shared/interfaces/shop.interface";
import { promoCodeApi } from "../services/promoCode.services";

export function useShopPromoCodesQuery() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId) || "";

  return useQuery({
    queryKey: queryKeys.shopPromoCodes(shopId),
    queryFn: async () => {
      const response: PromoCodesListResponse = await promoCodeApi.getPromoCodes(shopId);
      return response.data || response.items || [];
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

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
      return promoCodeApi.updatePromoCodeStatus(shopId, promoCodeId, isActive);
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
