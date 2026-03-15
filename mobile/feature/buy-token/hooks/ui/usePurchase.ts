import { purchaseApi } from "@/feature/buy-token/services/purchase.services";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Linking } from "react-native";
import { usePaymentStore } from "@/shared/store/payment.store";
import { useAppToast } from "@/shared/hooks";

export function usePurchase() {
  const { showError } = useAppToast();

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
          showError("Please log in again to continue with your purchase.");
        } else if (error.response?.status === 400) {
          showError(error.response?.data?.error || "Invalid purchase amount");
        } else {
          showError(error.message || "Failed to initiate purchase. Please try again.");
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
      isValidAmount: amount >= 5 && amount <= 100000,
    };
  };

  return {
    useCreatePaymentIntent,
    usePurchaseAmount,
  };
}
