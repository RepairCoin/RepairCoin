import { useState, useCallback } from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { apiClient } from "@/shared/utilities/axios";
import { useShop } from "../../account/hooks/useShopQuery";
import {
  SubscriptionTier,
  isValidTier,
  getPlanByTier,
  TRIAL_PERIOD_DAYS,
} from "../constants/subscriptionPlans";

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
      tier?: string | null;
      planLabel?: string | null;
      monthlyAmount?: number;
      subscriptionType?: string;
      scheduledDowngrade?: {
        tier: string;
        effectiveAt: string | null;
      } | null;
    };
  };
  error?: string;
}

interface ChangePlanResponse {
  success: boolean;
  data?: {
    message: string;
    isUpgrade: boolean;
    outcome: "upgraded" | "downgrade_scheduled" | "downgrade_canceled";
    tier: string;
    monthlyAmount: number;
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

interface TrialEligibilityResponse {
  success: boolean;
  data?: {
    eligible: boolean;
    trialUsed: boolean;
    hasActiveSubscription: boolean;
    trialPeriodDays: number;
  };
  error?: string;
}

interface StartTrialResponse {
  success: boolean;
  data?: {
    message: string;
    tier: string;
    trialEndsAt: string;
    trialPeriodDays: number;
  };
  error?: string;
}

export function useSubscription() {
  const router = useRouter();
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();
  const { data: shopData, refetch } = useGetShopByWalletAddress(account?.address || "");
  const { showSuccess, showError } = useAppToast();

  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [trialEligible, setTrialEligible] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<{
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    tier?: SubscriptionTier | null;
    planLabel?: string | null;
    monthlyAmount?: number;
    subscriptionType?: string;
    scheduledDowngrade?: {
      tier: SubscriptionTier;
      effectiveAt: string | null;
    } | null;
  } | null>(null);

  const isSubscribed = shopData?.operational_status === "subscription_qualified";
  const isPendingCancellation = subscriptionDetails?.cancelAtPeriodEnd === true;
  const isOnTrial = subscriptionDetails?.subscriptionType === "trial";
  // Plan changes go through Stripe (prorated upgrade / scheduled downgrade), so
  // they only apply to Stripe-billed subscriptions that aren't ending already.
  const canChangePlan =
    isSubscribed &&
    !isPendingCancellation &&
    subscriptionDetails?.subscriptionType === "stripe_subscription" &&
    isValidTier(subscriptionDetails?.tier);

  const fetchSubscriptionDetails = useCallback(async () => {
    if (!isSubscribed) {
      setSubscriptionDetails(null);
      return;
    }

    try {
      console.log("[Subscription] Fetching subscription status...");

      const result = await apiClient.get<SubscriptionStatusResponse>(
        "/shops/subscription/status",
        { timeout: 30000 }
      );

      console.log("[Subscription] API Response:", JSON.stringify(result, null, 2));

      if (result.success && result.data?.currentSubscription) {
        const sub = result.data.currentSubscription;
        const details = {
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          tier: isValidTier(sub.tier) ? sub.tier : null,
          planLabel: sub.planLabel ?? null,
          monthlyAmount: sub.monthlyAmount,
          subscriptionType: sub.subscriptionType,
          scheduledDowngrade:
            sub.scheduledDowngrade && isValidTier(sub.scheduledDowngrade.tier)
              ? {
                  tier: sub.scheduledDowngrade.tier,
                  effectiveAt: sub.scheduledDowngrade.effectiveAt,
                }
              : null,
        };
        console.log("[Subscription] Setting details:", details);
        setSubscriptionDetails(details);
      } else {
        console.log("[Subscription] No current subscription in response");
        setSubscriptionDetails(null);
      }
    } catch (error: any) {
      console.error("[Subscription] Failed to fetch subscription details:", error?.message || error);
      setSubscriptionDetails(null);
    }
  }, [isSubscribed]);

  const fetchTrialEligibility = useCallback(async () => {
    if (isSubscribed) {
      setTrialEligible(false);
      return;
    }

    try {
      const result = await apiClient.get<TrialEligibilityResponse>(
        "/shops/subscription/trial-eligibility"
      );
      setTrialEligible(!!result.data?.eligible);
    } catch {
      setTrialEligible(false);
    }
  }, [isSubscribed]);

  useFocusEffect(
    useCallback(() => {
      fetchSubscriptionDetails();
      fetchTrialEligibility();
    }, [fetchSubscriptionDetails, fetchTrialEligibility])
  );

  const handleSubscribe = (tier: SubscriptionTier) => {
    router.push({
      pathname: "/shop/subscription-form",
      params: { tier },
    } as any);
  };

  const handleStartTrial = (tier: SubscriptionTier) => {
    Alert.alert(
      "Start Free Trial",
      `Start your ${TRIAL_PERIOD_DAYS}-day free trial of ${getPlanByTier(tier).label}? Full access, no credit card required.`,
      [
        {
          text: "Not Now",
          style: "cancel",
        },
        {
          text: "Start Trial",
          onPress: () => startTrial(tier),
        },
      ]
    );
  };

  const startTrial = async (tier: SubscriptionTier) => {
    try {
      setIsStartingTrial(true);

      const result = await apiClient.post<StartTrialResponse>(
        "/shops/subscription/start-trial",
        { tier }
      );

      if (result.success) {
        setTrialEligible(false);
        await refetch();
        await fetchSubscriptionDetails();

        showSuccess(
          result.data?.message ||
            "Your free trial has started. No credit card required."
        );
      } else {
        throw new Error(result.error || "Failed to start free trial");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to start free trial";
      showError(errorMessage);
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleChangePlan = (newTier: SubscriptionTier) => {
    if (!canChangePlan || !subscriptionDetails) return;

    const currentTier = subscriptionDetails.tier;
    const newPlan = getPlanByTier(newTier);

    // Re-selecting the live tier only makes sense to cancel a pending downgrade.
    if (newTier === currentTier) {
      if (!subscriptionDetails.scheduledDowngrade) return;
      Alert.alert(
        "Keep Current Plan",
        `Cancel the scheduled downgrade and stay on ${
          subscriptionDetails.planLabel ?? newPlan.label
        }? You won't be charged anything today.`,
        [
          { text: "Not Now", style: "cancel" },
          { text: "Keep Current Plan", onPress: () => changePlan(newTier) },
        ]
      );
      return;
    }

    const currentAmount =
      subscriptionDetails.monthlyAmount ??
      (currentTier ? getPlanByTier(currentTier).price : 0);
    const isUpgrade = newPlan.price > currentAmount;

    const renewalDate = subscriptionDetails.currentPeriodEnd
      ? new Date(subscriptionDetails.currentPeriodEnd).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    Alert.alert(
      isUpgrade ? "Upgrade Plan" : "Downgrade Plan",
      isUpgrade
        ? `Upgrade to ${newPlan.label} for $${newPlan.price}/mo? The upgrade starts right away and the prorated difference will be charged to your card today.`
        : `Switch to ${newPlan.label} ($${newPlan.price}/mo)? The change takes effect at your next renewal${
            renewalDate ? ` on ${renewalDate}` : ""
          }. You keep your current plan until then — no refund for this month.`,
      [
        { text: "Not Now", style: "cancel" },
        {
          text: isUpgrade ? "Upgrade" : "Downgrade",
          onPress: () => changePlan(newTier),
        },
      ]
    );
  };

  const changePlan = async (newTier: SubscriptionTier) => {
    try {
      setIsChangingPlan(true);

      const result = await apiClient.post<ChangePlanResponse>(
        "/shops/subscription/change-plan",
        { tier: newTier }
      );

      if (result.success) {
        await refetch();
        await fetchSubscriptionDetails();

        showSuccess(result.data?.message || "Your subscription plan has been updated.");
      } else {
        throw new Error(result.error || "Failed to change plan");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to change plan";
      showError(errorMessage);
    } finally {
      setIsChangingPlan(false);
    }
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
        await refetch();
        await fetchSubscriptionDetails();

        showSuccess(result.data?.message || "Your subscription has been cancelled. You still have full access until the end of your billing period.");
      } else {
        throw new Error(result.error || "Failed to cancel subscription");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to cancel subscription";
      showError(errorMessage);
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
        showSuccess(result.data?.message || "Your subscription has been reactivated successfully.");
        refetch();
        setSubscriptionDetails((prev) =>
          prev ? { ...prev, cancelAtPeriodEnd: false } : null
        );
      } else {
        throw new Error(result.error || "Failed to reactivate subscription");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to reactivate subscription";
      showError(errorMessage);
    } finally {
      setIsReactivating(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const expirationDate = subscriptionDetails?.currentPeriodEnd
    ? new Date(subscriptionDetails.currentPeriodEnd)
    : null;

  return {
    isSubscribed,
    isPendingCancellation,
    isOnTrial,
    canChangePlan,
    expirationDate,
    currentPlan: subscriptionDetails
      ? {
          tier: subscriptionDetails.tier ?? null,
          planLabel: subscriptionDetails.planLabel ?? null,
          monthlyAmount: subscriptionDetails.monthlyAmount,
        }
      : null,
    scheduledDowngrade: subscriptionDetails?.scheduledDowngrade ?? null,
    shopData,
    isCancelling,
    isReactivating,
    isChangingPlan,
    trialEligible,
    isStartingTrial,
    handleStartTrial,
    handleSubscribe,
    handleChangePlan,
    handleCancelSubscription,
    handleResubscribe,
    handleGoBack,
  };
}
