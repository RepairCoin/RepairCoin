import { Alert, Linking } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/store/auth.store";
import { usePaymentStore } from "@/shared/store/payment.store";
import { purchaseApi } from "@/feature/buy-token/services/purchase.services";

export function useCreateStripeCheckoutMutation() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;

  return useMutation({
    mutationFn: async (amount: number) => {
      if (!shopId) {
        throw new Error("Shop not authenticated");
      }
      if (amount < 5) {
        throw new Error("Minimum purchase amount is 5 RCN");
      }
      return purchaseApi.createStripeCheckout(amount);
    },
    onSuccess: async (data) => {
      // Store the session data so we can validate on success screen
      usePaymentStore.getState().setActiveSession({
        type: "token_purchase",
        orderId: data.data.purchaseId,
        sessionId: data.data.sessionId,
        tokenAmount: data.data.amount,
        totalCost: data.data.totalCost,
      });

      // Small delay to ensure persist middleware writes to AsyncStorage
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Open the Stripe checkout URL in the browser
      const checkoutUrl = data.data.checkoutUrl;
      if (checkoutUrl) {
        const canOpen = await Linking.canOpenURL(checkoutUrl);
        if (canOpen) {
          await Linking.openURL(checkoutUrl);
        } else {
          usePaymentStore.getState().clearSession();
          Alert.alert(
            "Unable to Open Browser",
            "Please try again or contact support.",
            [{ text: "OK" }]
          );
        }
      }
    },
    onError: (error: any) => {
      console.error("Failed to create Stripe checkout:", error);

      if (error.response?.status === 401) {
        Alert.alert(
          "Authentication Required",
          "Please log in again to continue with your purchase.",
          [{ text: "OK" }]
        );
      } else if (error.response?.status === 400) {
        Alert.alert(
          "Invalid Request",
          error.response?.data?.error || "Invalid purchase amount",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Purchase Failed",
          error.message || "Failed to initiate purchase. Please try again.",
          [{ text: "OK" }]
        );
      }
    },
  });
}
