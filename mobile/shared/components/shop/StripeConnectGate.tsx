import React, { ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConnectSummaryQuery } from "@/feature/shop/payouts/hooks/useShopPayoutsQuery";

/**
 * Hard-locks a shop surface (services management, bookings) until Stripe Connect
 * onboarding is complete. Mirrors web's StripeConnectGuard.tsx — renders children
 * underneath, dims them, and overlays a blocking card. Unlike StripeConnectModal
 * (reactive, opened from a mutation's 403), this is proactive: it blocks browsing
 * the surface at all, not just the specific create/approve/complete action.
 */
export function StripeConnectGate({
  children,
  feature,
}: {
  children: ReactNode;
  feature: string;
}) {
  const router = useRouter();
  const { data: summary, isLoading } = useConnectSummaryQuery();

  // Fail open while loading / on fetch error — the backend still enforces
  // STRIPE_NOT_CONNECTED on the actual write actions, so this overlay is a UX
  // layer, not the security boundary.
  const isBlocked = !isLoading && summary?.chargesEnabled === false;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {isBlocked && (
        <View
          style={StyleSheet.absoluteFillObject}
          className="bg-black/80 items-center justify-center px-8"
        >
          <View className="w-16 h-16 rounded-full bg-[#FFCC00]/20 items-center justify-center mb-4">
            <Ionicons name="card-outline" size={30} color="#FFCC00" />
          </View>
          <Text className="text-[#FFCC00] text-lg font-bold text-center mb-2">
            Connect Stripe to Enable {feature}
          </Text>
          <Text className="text-gray-300 text-sm text-center leading-5 mb-6">
            Set up your payouts so customer payments can settle to your shop.
            You can create services and accept bookings once Stripe is
            connected.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(dashboard)/shop/payouts")}
            activeOpacity={0.85}
            className="bg-[#FFCC00] rounded-xl px-6 py-3"
          >
            <Text className="text-black font-bold text-sm">
              Set Up Payouts
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
