import { useMutation } from "@tanstack/react-query";
import { Alert } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { queryClient, queryKeys } from "@/config/queryClient";
import { promoCodeApi } from "@/feature/promo-code/services/promocode.services";
import { shopApi } from "@/services/shop.services";
import { CreatePromoCodeRequest } from "@/interfaces/shop.interface";

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

  return useMutation({
    mutationFn: async (promoCodeData: CreatePromoCodeRequest) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return shopApi.createPromoCode(shopId, promoCodeData);
    },
    onSuccess: () => {
      Alert.alert(
        "Success",
        "Promo code created successfully!",
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      );

      // Invalidate promo codes list to refresh
      if (shopId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopPromoCodes(shopId),
        });
      }
    },
    onError: (error: any) => {
      console.error("Failed to create promo code:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to create promo code",
        [{ text: "OK" }]
      );
    },
  });
}
