import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { TabButtons } from "@/shared/components/ui/TabButtons";
import CalloutCard from "@/shared/components/ui/CalloutCard";
import { useSubscription } from "../hooks";
import {
  SubscriptionHeader,
  SubscriptionStatusBadge,
  SubscriptionIcon,
  PlanCard,
  SubscriptionActionButton,
} from "../components";
import {
  SUBSCRIPTION_PLANS,
  DEFAULT_TIER,
  TRIAL_PERIOD_DAYS,
  SubscriptionTier,
  getPlanByTier,
  isValidTier,
} from "../constants/subscriptionPlans";

const PLAN_TABS = SUBSCRIPTION_PLANS.map((plan) => ({
  key: plan.tier,
  label: plan.label.replace(" AI", ""),
  sublabel: `$${plan.price}/mo`,
}));

export default function SubscriptionScreen() {
  const {
    isSubscribed,
    isPendingCancellation,
    expirationDate,
    currentPlan,
    isCancelling,
    isReactivating,
    trialEligible,
    isStartingTrial,
    handleStartTrial,
    handleSubscribe,
    handleCancelSubscription,
    handleResubscribe,
    handleGoBack,
  } = useSubscription();

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(DEFAULT_TIER);

  // When subscribed, show the current plan; otherwise show the tier being selected
  const displayTier = isSubscribed
    ? currentPlan?.tier ?? DEFAULT_TIER
    : selectedTier;
  const displayPlan = getPlanByTier(displayTier);
  const displayPrice = isSubscribed
    ? currentPlan?.monthlyAmount || displayPlan.price
    : displayPlan.price;
  const displayLabel = isSubscribed
    ? currentPlan?.planLabel ?? displayPlan.label
    : displayPlan.label;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getHeaderText = () => {
    if (isPendingCancellation) {
      return "Subscription Ending";
    }
    return isSubscribed ? "You're Subscribed!" : "Choose Your Plan";
  };

  const getSubheaderText = () => {
    if (isPendingCancellation && expirationDate) {
      return `Your subscription will end on ${formatDate(expirationDate)}`;
    }
    return isSubscribed
      ? "Enjoy all premium features for your repair business"
      : "Pick the plan that fits your shop. Upgrade or cancel anytime.";
  };

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-16 px-4 gap-4 flex-1">
        <SubscriptionHeader title="Subscription" onBack={handleGoBack} />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {isPendingCancellation && (
            <CalloutCard
              tone="warning"
              icon="warning"
              title="Cancellation Scheduled"
              description={`You still have full access until ${
                expirationDate ? formatDate(expirationDate) : ""
              }`}
              className="mb-5"
            />
          )}

          <View className="items-center mb-6 mt-2">
            <SubscriptionIcon isSubscribed={isSubscribed} />
            <Text className="text-white text-2xl font-bold mb-1">
              {getHeaderText()}
            </Text>
            <Text className="text-white/50 text-center text-sm px-8 leading-5">
              {getSubheaderText()}
            </Text>
          </View>

          <SubscriptionStatusBadge
            isSubscribed={isSubscribed}
            isPendingCancellation={isPendingCancellation}
          />

          {!isSubscribed && (
            <TabButtons
              tabs={PLAN_TABS}
              activeTab={selectedTier}
              onTabChange={(tier) => {
                if (isValidTier(tier)) setSelectedTier(tier);
              }}
              className="mb-4"
            />
          )}

          <PlanCard
            isSubscribed={isSubscribed}
            planLabel={displayLabel}
            price={displayPrice}
            includesLabel={displayPlan.includesLabel}
            features={displayPlan.features}
            popular={displayPlan.popular}
          />

          <SubscriptionActionButton
            isSubscribed={isSubscribed}
            isPendingCancellation={isPendingCancellation}
            isLoading={isCancelling || isReactivating}
            onSubscribe={() => handleSubscribe(selectedTier)}
            onCancel={handleCancelSubscription}
            onResubscribe={handleResubscribe}
          />

          {!isSubscribed && trialEligible && (
            <CalloutCard
              tone="info"
              icon="gift-outline"
              title={`Not ready to pay? Try it free for ${TRIAL_PERIOD_DAYS} days.`}
              description="Full access, no credit card required. Subscribe anytime to keep your shop running after the trial."
              action={{
                label: `Start ${TRIAL_PERIOD_DAYS}-Day Free Trial`,
                onPress: () => handleStartTrial(selectedTier),
                loading: isStartingTrial,
              }}
              className="mt-4 p-5"
            />
          )}

          {!isSubscribed && (
            <View className="flex-row items-center justify-center gap-1.5 mt-4">
              <Ionicons name="shield-checkmark" size={14} color="#6B7280" />
              <Text className="text-gray-500 text-xs">
                Secure payment via Stripe · Cancel anytime
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </ThemedView>
  );
}
