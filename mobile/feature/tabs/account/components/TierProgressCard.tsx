import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Tier } from "@/shared/utilities/GlobalTypes";

interface TierConfig {
  color: [string, string];
  label: string;
  bonus: number;
  requirement: number;
}

const TIER_CONFIG: Record<Tier, TierConfig> = {
  BRONZE: {
    color: ["#95602B", "#D4A574"],
    label: "Bronze",
    bonus: 0,
    requirement: 0,
  },
  SILVER: {
    color: ["#ABABAB", "#E8E8E8"],
    label: "Silver",
    bonus: 2,
    requirement: 200,
  },
  GOLD: {
    color: ["#FFCC00", "#FFE566"],
    label: "Gold",
    bonus: 5,
    requirement: 1000,
  },
};

const TIER_ORDER: Tier[] = ["BRONZE", "SILVER", "GOLD"];

interface TierProgressCardProps {
  currentTier: string;
  lifetimeEarnings: number;
}

export default function TierProgressCard({
  currentTier,
  lifetimeEarnings,
}: TierProgressCardProps) {
  const tier = (currentTier?.toUpperCase() || "BRONZE") as Tier;
  const currentTierIndex = TIER_ORDER.indexOf(tier);
  const nextTier = currentTierIndex < TIER_ORDER.length - 1
    ? TIER_ORDER[currentTierIndex + 1]
    : null;
  const nextTierConfig = nextTier ? TIER_CONFIG[nextTier] : null;
  const currentTierConfig = TIER_CONFIG[tier];

  // Calculate progress
  const currentRequirement = currentTierConfig.requirement;
  const nextRequirement = nextTierConfig?.requirement || lifetimeEarnings;
  const progressRange = nextRequirement - currentRequirement;
  const currentProgress = lifetimeEarnings - currentRequirement;
  const progressPercentage = progressRange > 0
    ? Math.min((currentProgress / progressRange) * 100, 100)
    : 100;
  const rcnToNextTier = nextTierConfig
    ? Math.max(nextRequirement - lifetimeEarnings, 0)
    : 0;

  // Already at max tier
  if (!nextTier || !nextTierConfig) {
    return (
      <TouchableOpacity
        onPress={() => router.push("/customer/tier-info")}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[currentTierConfig.color[0] + "30", "#18181b"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="mx-4 mt-4 p-4 border border-zinc-800"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: currentTierConfig.color[0] + "30" }}
              >
                <Ionicons name="trophy" size={20} color={currentTierConfig.color[0]} />
              </View>
              <View className="ml-3">
                <Text className="text-white font-semibold">Max Tier Reached!</Text>
                <Text className="text-zinc-500 text-xs mt-0.5">
                  You're a {currentTierConfig.label} member
                </Text>
              </View>
            </View>
            <View
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: currentTierConfig.color[0] + "20" }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: currentTierConfig.color[0] }}
              >
                +{currentTierConfig.bonus} RCN Bonus
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // nextTierConfig is guaranteed to be non-null here
  return (
    <TouchableOpacity
      onPress={() => router.push("/customer/tier-info")}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[nextTierConfig.color[0] + "20", "#18181b"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="mx-4 mt-4 p-4 border border-zinc-800"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <View
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: nextTierConfig.color[0] + "30" }}
            >
              <Ionicons name="trending-up" size={16} color={nextTierConfig.color[0]} />
            </View>
            <Text className="text-white font-semibold ml-2">
              Progress to {nextTierConfig.label}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#71717a" />
        </View>

        {/* Progress Bar */}
        <View className="mb-3">
          <View className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <LinearGradient
              colors={nextTierConfig.color}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-full rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-zinc-500 text-xs">Current</Text>
            <Text className="text-white font-semibold">
              {lifetimeEarnings.toLocaleString()} RCN
            </Text>
          </View>
          <View className="items-center">
            <Text
              className="text-xs font-semibold"
              style={{ color: nextTierConfig.color[0] }}
            >
              {rcnToNextTier.toLocaleString()} RCN to go
            </Text>
            <Text className="text-zinc-600 text-xs mt-0.5">
              {progressPercentage.toFixed(0)}% complete
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-zinc-500 text-xs">Goal</Text>
            <Text className="text-white font-semibold">
              {nextRequirement.toLocaleString()} RCN
            </Text>
          </View>
        </View>

        {/* Next Tier Benefit Preview */}
        <View
          className="mt-3 pt-3 border-t border-zinc-800 flex-row items-center"
        >
          <Ionicons name="gift-outline" size={14} color={nextTierConfig.color[0]} />
          <Text className="text-zinc-400 text-xs ml-1.5">
            Unlock <Text style={{ color: nextTierConfig.color[0] }} className="font-semibold">
              +{nextTierConfig.bonus} RCN bonus
            </Text> on every reward
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
