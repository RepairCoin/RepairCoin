import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { shopApi } from "@/feature/shop/services/shop.services";
import { useAuthStore } from "@/feature/auth/store/auth.store";

interface RewardTransaction {
  id: string | number;
  amount: number;
  customerAddress: string;
  customerName?: string;
  createdAt: string;
  status: string;
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const shortAddress = (address: string) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

export default function RecentRewards() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  const { data, isLoading } = useQuery({
    queryKey: ["recentRewards", shopId],
    queryFn: () => shopApi.getRecentRewards(shopId!, 5),
    enabled: !!shopId,
    staleTime: 30 * 1000,
    select: (res) => res?.data?.transactions || res?.data || [],
  });

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

        {rewards.map((reward, index) => (
          <View
            key={reward.id || index}
            className={`flex-row items-center py-3 ${
              index < rewards.length - 1 ? "border-b border-zinc-800" : ""
            }`}
          >
            <View className="w-9 h-9 rounded-full bg-green-500/10 items-center justify-center mr-3">
              <Ionicons name="gift-outline" size={18} color="#22C55E" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-sm font-medium" numberOfLines={1}>
                {reward.customerName || shortAddress(reward.customerAddress)}
              </Text>
              <Text className="text-gray-500 text-xs mt-0.5">
                {formatTimeAgo(reward.createdAt)}
              </Text>
            </View>
            <Text className="text-[#FFCC00] font-bold text-sm">
              +{reward.amount} RCN
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
