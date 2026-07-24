import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useConnectSummaryQuery } from "@/feature/shop/payouts/hooks/useShopPayoutsQuery";

/**
 * Dashboard-visibility layer of the Stripe Connect gate (the hard-block layer is
 * StripeConnectModal, mounted in shop/_layout.tsx). Dismissal is session-only — a
 * plain useState, resets on next app open, same as DemoBanner — since payouts not
 * being connected is a real gap the shop should be nudged about again later, not
 * permanently silenced.
 */
export function PayoutSetupBanner() {
  const { data: summary, isLoading } = useConnectSummaryQuery();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed || summary?.chargesEnabled === true) return null;

  return (
    <View className="bg-[#1A1A1A] rounded-2xl p-4 mb-4 flex-row items-center border border-[#FFCC00]/30">
      <View className="bg-[#FFCC00]/20 rounded-full p-2.5 mr-3">
        <Ionicons name="card-outline" size={20} color="#FFCC00" />
      </View>
      <View className="flex-1">
        <Text className="text-white text-sm font-semibold">
          Set up payouts to accept bookings
        </Text>
        <Text className="text-gray-400 text-xs mt-0.5">
          Connect Stripe so customer payments can settle to your shop.
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => router.push("/(dashboard)/shop/payouts")}
        className="bg-[#FFCC00] rounded-lg px-3 py-2 ml-2"
        activeOpacity={0.85}
      >
        <Text className="text-black text-xs font-bold">Set Up</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        hitSlop={8}
        className="ml-2"
      >
        <Ionicons name="close" size={16} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );
}
