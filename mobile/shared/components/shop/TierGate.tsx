import React, { ReactNode } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFeatureAccessQuery } from "@/shared/hooks/useFeatureAccessQuery";
import { getRequiredTier, TIER_LABELS } from "@/shared/constants/featureTiers";
import CalloutCard from "@/shared/components/ui/CalloutCard";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";

/**
 * Hides a tier-gated shop surface (marketing, etc.) until the shop's plan actually includes it.
 * Unlike StripeConnectGate (fail-open overlay — a UX layer over a backend that still enforces the
 * real block), this fails CLOSED: the gated endpoints 403 outright, so a below-tier shop must never
 * see a screen that renders and then fails every request it fires.
 *
 * Three distinct states, never conflated:
 * - loading: an empty body, no upsell flash for a shop that turns out to be paying.
 * - error: the tier check itself failed (e.g. offline) — retryable, not the upsell.
 * - denied: below-tier — upsell with a CTA to the subscription screen. Children are not mounted,
 *   so no gated query underneath ever fires.
 */
export function TierGate({
  feature,
  description,
  children,
}: {
  feature: string;
  description?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { can, isLoading, isError, refetch } = useFeatureAccessQuery();

  if (isLoading) {
    return <View className="flex-1" />;
  }

  if (isError) {
    return (
      <View className="flex-1 px-4 pt-4">
        <CalloutCard
          tone="warning"
          icon="alert-circle-outline"
          title="Couldn't check your plan"
          description="We couldn't confirm your plan. Please try again."
          action={{ label: "Retry", onPress: () => refetch() }}
        />
      </View>
    );
  }

  if (!can(feature)) {
    const requiredTier = getRequiredTier(feature);
    const planLabel = requiredTier ? TIER_LABELS[requiredTier] : "a higher";

    return (
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-[#FFCC00]/20 items-center justify-center mb-4">
          <Ionicons name="lock-closed-outline" size={30} color="#FFCC00" />
        </View>
        <Text className="text-[#FFCC00] text-lg font-bold text-center mb-2">
          Marketing is on the {planLabel} plan
        </Text>
        <Text className="text-gray-300 text-sm text-center leading-5 mb-6">
          {description ?? "Upgrade your plan to unlock this feature."}
        </Text>
        <PrimaryButton
          title="View plans"
          onPress={() => router.push("/shop/subscription")}
        />
      </View>
    );
  }

  return <>{children}</>;
}
