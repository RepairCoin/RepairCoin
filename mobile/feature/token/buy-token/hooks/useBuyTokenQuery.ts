import { useAuthStore } from "@/feature/auth/store/auth.store";
import { usePaymentStore } from "@/feature/booking/store/payment.store";
import { shopApi } from "@/feature/shop/services/shop.services";
import { useAppToast } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import { useMutation } from "@tanstack/react-query";
import { Linking } from "react-native";

export function useBuyTokenQueries() {
  const { userProfile } = useAuthStore();

  const isQualified =
    userProfile?.operational_status === "subscription_qualified" ||
    userProfile?.operational_status === "rcg_qualified";

  return {
    shopData: userProfile,
    isQualified,
  };
}

export const useCreatePaymentIntent = (shopId: string) => {
  const { showError } = useAppToast();

  return useMutation({
    mutationFn: async (amount: number) => {
      if (!shopId) {
        throw new Error("Shop not authenticated");
      }
      if (amount < 5) {
        throw new Error("Minimum purchase amount is 5 RCN");
      }
      return shopApi.createTokenPurchasePaymentIntent(amount);
    },
    onSuccess: () => {},
    onError: (error: any) => {
      console.error("Failed to create payment intent:", error);

      if (error.response?.status === 401) {
        showError("Please log in again to continue with your purchase.");
      } else if (error.response?.status === 400) {
        showError(error.response?.data?.error || "Invalid purchase amount");
      } else {
        showError(
          error.message || "Failed to initiate purchase. Please try again.",
        );
      }
    },
  });
};

export function useCreateStripeCheckoutMutation() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;
  const { showError } = useAppToast();
  const { guard, reset } = useSubmitGuard();

  const mutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!shopId) {
        throw new Error("Shop not authenticated");
      }
      if (amount < 5) {
        throw new Error("Minimum purchase amount is 5 RCN");
      }
      return shopApi.createStripeCheckout(amount);
    },
    onSuccess: async (data) => {
      usePaymentStore.getState().setActiveSession({
        type: "token_purchase",
        orderId: data.data.purchaseId,
        sessionId: data.data.sessionId,
        tokenAmount: data.data.amount,
        totalCost: data.data.totalCost,
      });

      await new Promise((resolve) => setTimeout(resolve, 300));

      const checkoutUrl = data.data.checkoutUrl;
      if (checkoutUrl) {
        const canOpen = await Linking.canOpenURL(checkoutUrl);
        if (canOpen) {
          await Linking.openURL(checkoutUrl);
        } else {
          usePaymentStore.getState().clearSession();
          showError(
            "Unable to open browser. Please try again or contact support."
          );
        }
      }
    },
    onError: (error: any) => {
      console.error("Failed to create Stripe checkout:", error);

      if (error.response?.status === 401) {
        showError(
          "Please log in again to continue with your purchase."
        );
      } else if (error.response?.status === 400) {
        showError(
          error.response?.data?.error || "Invalid purchase amount"
        );
      } else {
        showError(
          error.message ||
            "Failed to initiate purchase. Please try again."
        );
      }
    },
    onSettled: reset,
  });

  return {
    ...mutation,
    mutate: (
      amount: number,
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      guard(() => mutation.mutate(amount, options));
    },
  };
}