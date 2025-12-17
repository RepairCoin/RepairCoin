import React from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons, SimpleLineIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/store/auth.store";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { AppHeader } from "@/components/ui/AppHeader";
import { Tier } from "@/utilities/GlobalTypes";

interface TierConfig {
  color: [string, string];
  label: string;
  bonus: number;
  requirement: number;
  benefits: string[];
}

const TIER_CONFIG: Record<Tier, TierConfig> = {
  BRONZE: {
    color: ["#95602B", "#D4A574"],
    label: "Bronze",
    bonus: 0,
    requirement: 0,
    benefits: [
      "Earn RCN on every repair",
      "20% redemption at any shop",
      "100% redemption at earning shop",
      "Access to service marketplace",
    ],
  },
  SILVER: {
    color: ["#ABABAB", "#E8E8E8"],
    label: "Silver",
    bonus: 2,
    requirement: 200,
    benefits: [
      "All Bronze benefits",
      "+2 RCN bonus on every reward",
      "Priority customer support",
      "Early access to promotions",
    ],
  },
  GOLD: {
    color: ["#FFCC00", "#FFE566"],
    label: "Gold",
    bonus: 5,
    requirement: 1000,
    benefits: [
      "All Silver benefits",
      "+5 RCN bonus on every reward",
      "Exclusive Gold member deals",
      "VIP customer support",
      "Special event invitations",
    ],
  },
};

const TIER_ORDER: Tier[] = ["BRONZE", "SILVER", "GOLD"];

export default function TierInfoScreen() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();

  const {
    data: customerData,
    isLoading,
    error,
    refetch,
  } = useGetCustomerByWalletAddress(account?.address);

  const currentTier = (customerData?.customer?.tier as Tier) || "BRONZE";
  const lifetimeEarnings = customerData?.customer?.lifetimeEarnings || 0;

  const currentTierIndex = TIER_ORDER.indexOf(currentTier);
  const nextTier = currentTierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIndex + 1] : null;
  const nextTierConfig = nextTier ? TIER_CONFIG[nextTier] : null;
  const progressToNextTier = nextTierConfig
    ? Math.min((lifetimeEarnings / nextTierConfig.requirement) * 100, 100)
    : 100;
  const rcnToNextTier = nextTierConfig
    ? Math.max(nextTierConfig.requirement - lifetimeEarnings, 0)
    : 0;

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Tier Benefits" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFCC00" />
          <Text className="text-gray-400 mt-4">Loading tier info...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Tier Benefits" />
        <View className="flex-1 justify-center items-center">
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text className="text-red-400 text-lg mt-4">Failed to load tier info</Text>
          <Pressable
            onPress={() => refetch()}
            className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-xl"
          >
            <Text className="text-black font-semibold">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Tier Benefits" />

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Current Tier Card */}
        <View className="mt-2 rounded-2xl overflow-hidden">
          <LinearGradient
            colors={TIER_CONFIG[currentTier].color}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="p-5 border-2 border-white"
          >
            <View className="flex-row items-center justify-between m-2">
              <View>
                <Text className="text-black/60 text-sm font-medium">Your Current Tier</Text>
                <Text className="text-black text-3xl font-bold mt-1">
                  {TIER_CONFIG[currentTier].label}
                </Text>
              </View>
              <View className="bg-black/20 rounded-full p-3">
                <SimpleLineIcons name="badge" size={28} color="#000" />
              </View>
            </View>

            {/* Progress to next tier */}
            {nextTier && (
              <View className="mt-5">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-black/70 text-sm">Progress to {TIER_CONFIG[nextTier].label}</Text>
                  <Text className="text-black font-semibold">{rcnToNextTier} RCN to go</Text>
                </View>
                <View className="bg-black/20 rounded-full h-2.5">
                  <View
                    className="bg-black rounded-full h-2.5"
                    style={{ width: `${progressToNextTier}%` }}
                  />
                </View>
                <Text className="text-black/60 text-xs mt-1.5 text-center">
                  {lifetimeEarnings} / {nextTierConfig?.requirement} RCN lifetime earnings
                </Text>
              </View>
            )}

            {!nextTier && (
              <View className="mt-4 bg-black/20 p-3">
                <Text className="text-black text-center font-semibold">
                  You've reached the highest tier!
                </Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Current Tier Benefits */}
        <View className="mt-6">
          <Text className="text-white text-lg font-bold mb-3">Your Benefits</Text>
          <View className="bg-zinc-900 rounded-xl p-4">
            {TIER_CONFIG[currentTier].benefits.map((benefit, index) => (
              <View key={index} className="flex-row items-center mb-3 last:mb-2">
                <View className="bg-green-500/20 rounded-full p-1 mr-3">
                  <Ionicons name="checkmark" size={16} color="#22C55E" />
                </View>
                <Text className="text-gray-300 flex-1">{benefit}</Text>
              </View>
            ))}
            {TIER_CONFIG[currentTier].bonus > 0 && (
              <View className="mt-3 pt-3 border-t border-zinc-800">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="plus-circle" size={20} color="#FFCC00" />
                  <Text className="text-[#FFCC00] font-semibold ml-2">
                    +{TIER_CONFIG[currentTier].bonus} RCN bonus on every reward
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* All Tiers Overview */}
        <View className="mt-6 mb-8">
          <Text className="text-white text-lg font-bold mb-3">All Tiers</Text>
          {TIER_ORDER.map((tier, index) => {
            const config = TIER_CONFIG[tier];
            const isCurrentTier = tier === currentTier;
            const isUnlocked = index <= currentTierIndex;

            return (
              <View
                key={tier}
                className={`mb-3 rounded-xl overflow-hidden ${
                  isCurrentTier ? "border-2 border-[#FFCC00]" : ""
                }`}
              >
                <LinearGradient
                  colors={isUnlocked ? config.color : ["#3f3f46", "#52525b"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="p-4"
                >
                  <View className="flex-row items-center m-2 justify-between">
                    <View className="flex-row items-center">
                      <SimpleLineIcons
                        name="badge"
                        size={24}
                        color={isUnlocked ? "#000" : "#9CA3AF"}
                      />
                      <View className="ml-3">
                        <Text
                          className={`text-lg font-bold ${
                            isUnlocked ? "text-black" : "text-gray-400"
                          }`}
                        >
                          {config.label}
                        </Text>
                        <Text
                          className={`text-sm ${
                            isUnlocked ? "text-black/70" : "text-gray-500"
                          }`}
                        >
                          {config.requirement === 0
                            ? "Starting tier"
                            : `${config.requirement} RCN required`}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      {config.bonus > 0 && (
                        <Text
                          className={`font-bold ${
                            isUnlocked ? "text-black" : "text-gray-400"
                          }`}
                        >
                          +{config.bonus} RCN
                        </Text>
                      )}
                      {isCurrentTier && (
                        <View className="bg-black/30 rounded-full px-2 py-1 mt-1">
                          <Text className="text-black text-xs font-semibold">Current</Text>
                        </View>
                      )}
                      {!isUnlocked && (
                        <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
