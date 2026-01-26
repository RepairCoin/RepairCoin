import { useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { useAuthStore } from "@/shared/store/auth.store";
import { useModalStore } from "@/shared/store/common.store";
import { PaymentParams } from "../../types";
import { DEFAULT_SUBSCRIPTION_AMOUNT } from "../../constants";

export function usePayment() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { account } = useAuthStore();
  const { setShowSubscriptionModal } = useModalStore();

  const {
    clientSecret,
    subscriptionId,
    purchaseId,
    amount,
    totalCost,
    type = "subscription",
  } = useLocalSearchParams<PaymentParams>();

  const { confirmPayment } = useStripe();
  const [isLoading, setIsLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTokenPurchase = type === "token_purchase";
  const displayAmount = totalCost
    ? parseFloat(totalCost).toFixed(2)
    : DEFAULT_SUBSCRIPTION_AMOUNT;
  const tokenAmount = amount ? parseInt(amount) : 0;

  const handleCardChange = (cardDetails: { complete: boolean }) => {
    setCardComplete(cardDetails.complete);
    if (error) setError(null);
  };

  const handlePay = async () => {
    if (!clientSecret) {
      Alert.alert("Error", "Payment session not found. Please try again.");
      return;
    }

    if (!cardComplete) {
      Alert.alert("Error", "Please complete your card details.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { paymentIntent, error: stripeError } = await confirmPayment(
        clientSecret,
        {
          paymentMethodType: "Card",
        }
      );

      if (stripeError) {
        setError(stripeError.message);
        Alert.alert("Payment Failed", stripeError.message);
        return;
      }

      if (paymentIntent) {
        // Invalidate shop queries to refetch updated data
        if (account?.address) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.shopByWalletAddress(account.address),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.shops(),
          });
        }

        if (isTokenPurchase) {
          // Token purchase success - navigate to success screen with params
          router.replace({
            pathname: "/shop/payment/payment-success",
            params: {
              type: "token_purchase",
              amount: amount || "0",
              purchaseId: purchaseId || "",
              totalCost: totalCost || "0",
            },
          });
        } else {
          // Subscription success - close modal and navigate to success screen
          setShowSubscriptionModal(false);
          router.replace("/shop/payment/payment-success");
        }
      }
    } catch (err: any) {
      const errorMessage = err.message || "Payment failed. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return {
    clientSecret,
    isLoading,
    cardComplete,
    error,
    isTokenPurchase,
    displayAmount,
    tokenAmount,
    handleCardChange,
    handlePay,
    handleCancel,
  };
}
