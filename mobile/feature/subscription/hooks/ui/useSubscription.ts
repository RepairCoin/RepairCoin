import { useState, useEffect, useCallback } from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "@/shared/store/auth.store";
import { useShop } from "@/shared/hooks/shop/useShop";
import { apiClient } from "@/shared/utilities/axios";

interface CancelSubscriptionResponse {
  success: boolean;
  data?: {
    message: string;
    effectiveDate: string;
  };
  error?: string;
}

interface SubscriptionStatusResponse {
  success: boolean;
  data?: {
    hasActiveSubscription: boolean;
    currentSubscription?: {
      status: string;
      currentPeriodEnd?: string;
      cancelAtPeriodEnd?: boolean;
    };
  };
  error?: string;
}

interface ReactivateSubscriptionResponse {
  success: boolean;
  data?: {
    message: string;
  };
  error?: string;
}

export function useSubscription() {
  const router = useRouter();
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();
  const { data: shopData, refetch } = useGetShopByWalletAddress(account?.address || "");

  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<{
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
  } | null>(null);

  const isSubscribed = shopData?.operational_status === "subscription_qualified";
  const isPendingCancellation = subscriptionDetails?.cancelAtPeriodEnd === true;

  // Fetch subscription details when screen is focused
  const fetchSubscriptionDetails = useCallback(async () => {
    if (!isSubscribed) {
      setSubscriptionDetails(null);
      return;
    }

    try {
      console.log("[Subscription] Fetching subscription status...");

      // Use a longer timeout (30 seconds) for this endpoint since it calls Stripe API
      const result = await apiClient.get<SubscriptionStatusResponse>(
        "/shops/subscription/status",
        { timeout: 30000 }
      );

      console.log("[Subscription] API Response:", JSON.stringify(result, null, 2));

      if (result.success && result.data?.currentSubscription) {
        const details = {
          currentPeriodEnd: result.data.currentSubscription.currentPeriodEnd,
          cancelAtPeriodEnd: result.data.currentSubscription.cancelAtPeriodEnd,
        };
        console.log("[Subscription] Setting details:", details);
        setSubscriptionDetails(details);
      } else {
        console.log("[Subscription] No current subscription in response");
        setSubscriptionDetails(null);
      }
    } catch (error: any) {
      console.error("[Subscription] Failed to fetch subscription details:", error?.message || error);

      // Even if fetch fails, don't block the UI - user can still see subscription status
      // They just won't see the reactivate button until refresh succeeds
      setSubscriptionDetails(null);
    }
  }, [isSubscribed]);

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchSubscriptionDetails();
    }, [fetchSubscriptionDetails])
  );

  const handleSubscribe = () => {
    router.push("/shop/subscription-form" as any);
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel your subscription? Your subscription will remain active until the end of the current billing period.",
      [
        {
          text: "Keep Subscription",
          style: "cancel",
        },
        {
          text: "Cancel Subscription",
          style: "destructive",
          onPress: () => showCancellationReasonPrompt(),
        },
      ]
    );
  };

  const showCancellationReasonPrompt = () => {
    // Alert.prompt is iOS-only, so on Android we just cancel directly
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Cancellation Reason",
        "Please let us know why you're cancelling (optional)",
        [
          {
            text: "Skip",
            style: "cancel",
            onPress: () => cancelSubscription(),
          },
          {
            text: "Submit",
            onPress: (reason) => cancelSubscription(reason),
          },
        ],
        "plain-text",
        "",
        "default"
      );
    } else {
      // Android: cancel without reason prompt
      cancelSubscription();
    }
  };

  const cancelSubscription = async (reason?: string) => {
    try {
      setIsCancelling(true);

      const result = await apiClient.post<CancelSubscriptionResponse>(
        "/shops/subscription/cancel",
        { reason: reason || undefined }
      );

      if (result.success) {
        // Refetch data first, then show alert
        await refetch();
        await fetchSubscriptionDetails();

        Alert.alert(
          "Subscription Cancelled",
          result.data?.message || "Your subscription has been cancelled successfully. You still have full access until the end of your billing period.",
          [{ text: "OK" }]
        );
      } else {
        throw new Error(result.error || "Failed to cancel subscription");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to cancel subscription";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleResubscribe = () => {
    Alert.alert(
      "Reactivate Subscription",
      "Would you like to reactivate your subscription? Your subscription will continue without interruption.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reactivate",
          onPress: () => reactivateSubscription(),
        },
      ]
    );
  };

  const reactivateSubscription = async () => {
    try {
      setIsReactivating(true);

      const result = await apiClient.post<ReactivateSubscriptionResponse>(
        "/shops/subscription/reactivate"
      );

      if (result.success) {
        Alert.alert(
          "Subscription Reactivated",
          result.data?.message || "Your subscription has been reactivated successfully.",
          [
            {
              text: "OK",
              onPress: () => {
                refetch();
                setSubscriptionDetails((prev) =>
                  prev ? { ...prev, cancelAtPeriodEnd: false } : null
                );
              },
            },
          ]
        );
      } else {
        throw new Error(result.error || "Failed to reactivate subscription");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to reactivate subscription";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsReactivating(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  // Format expiration date for display
  const expirationDate = subscriptionDetails?.currentPeriodEnd
    ? new Date(subscriptionDetails.currentPeriodEnd)
    : null;

  return {
    isSubscribed,
    isPendingCancellation,
    expirationDate,
    shopData,
    isCancelling,
    isReactivating,
    handleSubscribe,
    handleCancelSubscription,
    handleResubscribe,
    handleGoBack,
  };
}
