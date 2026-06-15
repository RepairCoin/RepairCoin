import React from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRecentRewards } from "../hooks/useRewardQuery";

interface RewardTransaction {
  id: string | number;
  amount: number;
  customerAddress: string;
  customerName?: string;
  createdAt: string;
  status: string;
  customerTier?: string;
}

const shortAddress = (address: string) =>
  address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "";

const getTierBadge = (tier?: string) => {
  switch (tier?.toLowerCase()) {
    case "gold":
      return { bg: "#2A1F00", text: "#F59E0B", label: "GOLD" };
    case "silver":
      return { bg: "#1E1E1E", text: "#9CA3AF", label: "SILVER" };
    default:
      return { bg: "#2A1800", text: "#D97706", label: "BRONZE" };
  }
};

export default function RecentRewards() {
  const { data, isLoading } = useRecentRewards();

  const rewards: RewardTransaction[] = data || [];

  if (isLoading) {
    return (
      <View className="px-5 mb-6">
        <View className="bg-[#1A1A1A] rounded-2xl p-5 items-center py-8">
          <ActivityIndicator size="small" color="#FFCC00" />
        </View>
      </View>
    );
  }

  if (!rewards.length) return null;

  return (
    <View className="px-5 mb-6">
      <View className="bg-[#1A1A1A] rounded-2xl p-5">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-lg font-bold">Recent Rewards</Text>
          <View className="bg-[#FFCC00]/10 px-2.5 py-1 rounded-full">
            <Text className="text-[#FFCC00] text-xs font-semibold">
              Last {rewards.length}
            </Text>
          </View>
        </View>

        {rewards.map((reward, index) => {
          const badge = getTierBadge(reward.customerTier);
          return (
            <TouchableOpacity
              key={reward.id || index}
              activeOpacity={0.7}
              onPress={() =>
                router.push(
                  `/shop/profile/customer-profile/${reward.customerAddress}` as any
                )
              }
              className={`flex-row items-center py-3.5 ${
                index < rewards.length - 1 ? "border-b border-zinc-800" : ""
              }`}
            >
              <View className="w-10 h-10 rounded-full bg-[#2C2C2C] items-center justify-center mr-3">
                <Ionicons name="person" size={20} color="#6B7280" />
              </View>
              <View className="flex-1">
                <Text
                  className="text-white text-sm font-semibold"
                  numberOfLines={1}
                >
                  {reward.customerName || "Anonymous Customer"}
                </Text>
                <Text className="text-gray-500 text-xs mt-0.5">
                  {shortAddress(reward.customerAddress)}
                </Text>
              </View>
              <View
                className="px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: badge.bg }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: badge.text }}
                >
                  {badge.label}
                </Text>
              </View>
              <Text className="text-white font-bold text-sm ml-3 w-16 text-right">
                {reward.amount} RCN
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
