import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys } from "@/shared/hooks";
import { useConnectStatusQuery } from "@/feature/shop/payouts/hooks/useShopPayoutsQuery";

/**
 * Deep-link landing screen for repaircoin://shop/payouts/callback (see
 * backend/src/domains/shop/routes/connect.ts's mobileDeepLinkBase()). Trusts a live
 * GET /connect/status read, not the connected=1/error=1 query param — the param only
 * proves the shop's browser came back, not that Stripe actually approved them.
 */
export default function ShopPayoutsCallback() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ connected?: string; error?: string }>();

  // The OS may have cold-launched the app straight into this screen (killed while the
  // Stripe browser tab was open) — the persisted auth store may not be rehydrated yet.
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const {
    data: status,
    isLoading: isLoadingStatus,
    isError: statusFailed,
    refetch,
  } = useConnectStatusQuery({ enabled: hasHydrated });

  const isConnected = status?.chargesEnabled === true;
  const isPendingReview = status?.accountId != null && !isConnected;
  const deniedOrErrored = params.error === "1" || statusFailed;

  React.useEffect(() => {
    if (isConnected) {
      queryClient.invalidateQueries({ queryKey: queryKeys.connectSummary() });
    }
  }, [isConnected, queryClient]);

  const handleGoToDashboard = () => {
    router.replace("/(dashboard)/shop/tabs/home");
  };

  const handleTryAgain = () => {
    router.replace("/(dashboard)/shop/payouts");
  };

  if (!hasHydrated || isLoadingStatus) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-gray-400 text-sm mt-4">
          Confirming your Stripe connection...
        </Text>
      </ThemedView>
    );
  }

  if (deniedOrErrored) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <View className="bg-red-500/20 rounded-full p-6 mb-6">
          <Ionicons name="close-circle" size={64} color="#EF4444" />
        </View>
        <Text className="text-white text-2xl font-bold text-center mb-2">
          Connection Failed
        </Text>
        <Text className="text-gray-400 text-base text-center mb-8 px-4">
          We couldn't confirm your Stripe connection. You can try again.
        </Text>
        <TouchableOpacity
          onPress={handleTryAgain}
          className="bg-[#FFCC00] rounded-2xl py-4 w-full"
        >
          <Text className="text-black text-center font-bold text-lg">Try Again</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (isPendingReview) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <View className="bg-[#FFCC00]/20 rounded-full p-6 mb-6">
          <Ionicons name="time-outline" size={64} color="#FFCC00" />
        </View>
        <Text className="text-white text-2xl font-bold text-center mb-2">
          Almost There
        </Text>
        <Text className="text-gray-400 text-base text-center mb-8 px-4">
          Stripe is still reviewing your account. This can take a few minutes —
          refresh to check again.
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="bg-[#1A1A1A] rounded-2xl py-4 w-full border border-gray-700 mb-3"
        >
          <Text className="text-white text-center font-semibold text-lg">
            Refresh Status
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleGoToDashboard} className="py-2">
          <Text className="text-gray-500 text-center text-sm">
            I'll check back later
          </Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <View className="bg-green-500/20 rounded-full p-6 mb-6">
        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
      </View>
      <Text className="text-white text-3xl font-bold text-center mb-2">
        Payouts Connected!
      </Text>
      <Text className="text-gray-400 text-base text-center mb-8 px-4">
        Your Stripe account is connected. You can now create services and
        accept bookings.
      </Text>
      <TouchableOpacity
        onPress={handleGoToDashboard}
        className="bg-[#FFCC00] rounded-2xl py-4 w-full"
      >
        <Text className="text-black text-center font-bold text-lg">
          Go to Dashboard
        </Text>
      </TouchableOpacity>
    </ThemedView>
  );
}
