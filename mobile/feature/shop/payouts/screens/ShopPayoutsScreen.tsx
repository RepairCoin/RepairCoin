import React from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import {
  useConnectSummaryQuery,
  useCreateConnectOnboardingLinkMutation,
} from "../hooks/useShopPayoutsQuery";

const BENEFITS: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
}[] = [
  {
    icon: "shield",
    title: "Bank-Level Security",
    desc: "RepairCoin does not store your banking details. All sensitive data is processed directly by Stripe.",
  },
  {
    icon: "credit-card",
    title: "Automated Payments",
    desc: "Enable seamless RCN purchases, subscriptions, and redemptions for your shop.",
  },
  {
    icon: "check-circle",
    title: "Instant Activation",
    desc: "Once connected, your shop is officially verified and ready to operate inside the FixFlow network.",
  },
  {
    icon: "globe",
    title: "Global Payment Support",
    desc: "Accept cards, wallets, and international payments with built-in compliance and automatic currency handling.",
  },
];

export default function ShopPayoutsScreen() {
  const router = useRouter();
  const { data: summary, isLoading: isLoadingSummary } = useConnectSummaryQuery();
  const { mutate: startOnboarding, isPending: isStartingOnboarding } =
    useCreateConnectOnboardingLinkMutation();

  const isConnected = summary?.chargesEnabled === true;

  return (
    <ThemedView className="flex-1">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <AntDesign name="arrowleft" color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Payouts</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {isLoadingSummary ? (
          <View className="items-center py-16">
            <ActivityIndicator size="small" color="#FFCC00" />
          </View>
        ) : isConnected ? (
          <View className="px-5">
            <View className="bg-[#1A1A1A] rounded-2xl p-6 items-center border border-green-500/30 mt-4">
              <View className="bg-green-500/20 rounded-full p-4 mb-4">
                <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
              </View>
              <Text className="text-white text-lg font-bold mb-1">
                Payouts Connected
              </Text>
              <Text className="text-gray-400 text-sm text-center">
                Your Stripe account is connected. Customer payments settle
                directly to your shop.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View className="px-5 mt-2 mb-6">
              <Text className="text-[#FFCC00] text-lg font-bold mb-2">
                Secure Your Payouts with Stripe
              </Text>
              <Text className="text-gray-400 text-sm">
                Connect your Stripe account to securely receive customer
                payments, payouts, and future transactions through FixFlow.
              </Text>
            </View>

            <View className="px-5">
              {BENEFITS.map((item) => (
                <View
                  key={item.title}
                  className="bg-[#1A1A1A] rounded-2xl p-4 mb-3 flex-row items-start"
                >
                  <View className="w-9 h-9 rounded-full bg-[#FFCC00]/20 items-center justify-center mr-3">
                    <Feather name={item.icon} size={16} color="#FFCC00" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-sm mb-1">
                      {item.title}
                    </Text>
                    <Text className="text-gray-400 text-xs leading-5">
                      {item.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {!isLoadingSummary && !isConnected && (
        <View className="px-5 py-4 border-t border-gray-800 bg-black">
          <PrimaryButton
            title={isStartingOnboarding ? "Opening Stripe..." : "Connect with Stripe"}
            onPress={() => startOnboarding()}
            loading={isStartingOnboarding}
            disabled={isStartingOnboarding}
          />
          <Text className="text-gray-500 text-center text-xs mt-2">
            You'll be securely redirected to Stripe. FixFlow never stores your
            banking information.
          </Text>
        </View>
      )}
    </ThemedView>
  );
}
