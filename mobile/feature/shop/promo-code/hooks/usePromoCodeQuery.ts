import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { queryClient, queryKeys } from "@/shared/config/queryClient";
import { CreatePromoCodeRequest, PromoCodesListResponse } from "@/feature/shop/services/shop.interface";
import { shopApi as promoCodeApi, shopApi } from "@/feature/shop/services/shop.services";

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

export function useShopPromoCodes() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.shopPromoCodes(shopId || ""),
    queryFn: () => {
      if (!shopId) {
        throw new Error("No shop ID found");
      }
      return shopApi.getPromoCodes(shopId);
    },
    enabled: !!shopId,
    select: (data) => data.data || [],
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

export function useValidatePromoCode() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useMutation({
    mutationFn: async ({
      code,
      customerAddress,
    }: {
      code: string;
      customerAddress: string;
    }) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return shopApi.validatePromoCode(shopId, {
        code: code.trim(),
        customer_address: customerAddress,
      });
    },
    onError: (error: any) => {
      console.error("Failed to validate promo code:", error);
    },
  });
}

export function useUpdatePromoCodeStatus() {
  const rqClient = useQueryClient();
  const shopId = useAuthStore((state) => state.userProfile?.shopId);
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({
      promoCodeId,
      isActive,
    }: {
      promoCodeId: string;
      isActive: boolean;
    }) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return shopApi.updatePromoCodeStatus(shopId, promoCodeId, isActive);
    },
    onSuccess: (_, variables) => {
      if (shopId) {
        rqClient.invalidateQueries({
          queryKey: queryKeys.shopPromoCodes(shopId),
        });

        showSuccess(
          variables.isActive
            ? "Promo code activated successfully!"
            : "Promo code deactivated successfully!"
        );
      }
    },
    onError: (error: any, variables) => {
      console.error("Failed to update promo code status:", error);
      const statusText = variables.isActive ? "activate" : "deactivate";
      showError(
        error.response?.data?.message ||
          `Failed to ${statusText} promo code`
      );
    },
  });
}

export function useCreatePromoCode() {
  const rqClient = useQueryClient();
  const shopId = useAuthStore((state) => state.userProfile?.shopId);
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async (promoCodeData: CreatePromoCodeRequest) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return shopApi.createPromoCode(shopId, promoCodeData);
    },
    onSuccess: () => {
      showSuccess("Promo code created successfully!");
      router.back();

      if (shopId) {
        rqClient.invalidateQueries({
          queryKey: queryKeys.shopPromoCodes(shopId),
        });
      }
    },
    onError: (error: any) => {
      console.error("Failed to create promo code:", error);
      showError(
        error.response?.data?.error || "Failed to create promo code"
      );
    },
  });
}