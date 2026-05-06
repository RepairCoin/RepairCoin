import { View, Text } from "react-native";
import { PROFILE_COLORS } from "../constants";

interface CustomerStatsProps {
  lifetimeEarnings: number;
  totalRedemptions: number;
  totalRepairs: number;
}

export function CustomerStats({
  lifetimeEarnings,
  totalRedemptions,
  totalRepairs
}: CustomerStatsProps) {
  return (
    <View className="flex-row justify-around bg-zinc-900 rounded-2xl p-4 mx-4 mb-6">
      <View className="items-center">
        <Text
          className="text-xl font-bold"
          style={{ color: PROFILE_COLORS.primary }}
        >
          {lifetimeEarnings || 0}
        </Text>
        <Text className="text-gray-400 text-xs">RCN Earned</Text>
      </View>
      <View className="w-px bg-zinc-700" />
      <View className="items-center">
        <Text
          className="text-xl font-bold"
          style={{ color: PROFILE_COLORS.primary }}
        >
          {totalRedemptions || 0}
        </Text>
        <Text className="text-gray-400 text-xs">Redeemed</Text>
      </View>
      <View className="w-px bg-zinc-700" />
      <View className="items-center">
        <Text
          className="text-xl font-bold"
          style={{ color: PROFILE_COLORS.primary }}
        >
          {totalRepairs || 0}
        </Text>
        <Text className="text-gray-400 text-xs">Services</Text>
      </View>
    </View>
  );
}
