import { purchaseApi } from "@/services/purchase.services";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Linking } from "react-native";
import { usePaymentStore } from "@/store/payment.store";
import { queryKeys } from "@/config/queryClient";
import { PurchaseHistoryResponse } from "@/interfaces/purchase.interface";

export function usePurchase() {
  const useShopTransactions = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shopTransactions(shopId),
      queryFn: async () => {
        const response: PurchaseHistoryResponse =
          await purchaseApi.getShopTransactions(shopId);
        return response.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  // Hook for creating PaymentIntent (mobile - native card payment)
  const useCreatePaymentIntent = (shopId: string) => {
    return useMutation({
      mutationFn: async (amount: number) => {
        if (!shopId) {
          throw new Error("Shop not authenticated");
        }
        if (amount < 5) {
          throw new Error("Minimum purchase amount is 5 RCN");
        }
        return purchaseApi.createTokenPurchasePaymentIntent(amount);
      },
      onSuccess: () => {
        // Payment intent created successfully
      },
      onError: (error: any) => {
        console.error("Failed to create payment intent:", error);

        // Handle specific error cases
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
  };

  const usePurchaseAmount = (initialAmount = 5) => {
    const [amount, setAmount] = useState(initialAmount);

    // Calculate bonus based on amount
    const bonusAmount =
      amount >= 10000
        ? Math.floor(amount * 0.05)
        : amount >= 5000
          ? Math.floor(amount * 0.03)
          : amount >= 1000
            ? Math.floor(amount * 0.02)
            : 0;

    const totalCost = amount * 0.1;
    const totalTokens = amount + bonusAmount;
    const effectiveRate =
      totalTokens > 0 ? (totalCost / totalTokens).toFixed(3) : "0.100";

    return {
      amount,
      setAmount,
      bonusAmount,
      totalCost,
      totalTokens,
      effectiveRate,
      isValidAmount: amount >= 5,
    };
  };

  // Hook for creating Stripe Checkout session (web-based payment to avoid Apple IAP fees)
  const useCreateStripeCheckout = (shopId: string) => {
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
  };

  return {
    useShopTransactions,
    useCreatePaymentIntent,
    useCreateStripeCheckout,
    usePurchaseAmount,
  };
}
