import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TierInfo, RewardCalculation } from "../types";

interface RewardsSectionProps {
  tierInfo: TierInfo;
  reward: RewardCalculation;
}

export function RewardsSection({ tierInfo, reward }: RewardsSectionProps) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center mb-4">
        <Text className="text-white text-lg font-semibold ml-2">
          RCN Rewards
        </Text>
      </View>

      {/* Tier Badge & Rewards Card */}
      <View className="bg-[#1a1a1a] rounded-xl p-4">
        {/* Your Tier */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View
              className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${tierInfo.bgColor}`}
            >
              <Ionicons name="medal" size={22} color={tierInfo.color} />
            </View>
            <View>
              <Text className="text-gray-500 text-xs">Your Tier</Text>
              <Text
                className="text-white font-semibold"
                style={{ color: tierInfo.color }}
              >
                {tierInfo.tier}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-gray-500 text-xs">Tier Bonus</Text>
            <Text className="text-[#FFCC00] font-bold">
              +{tierInfo.tierBonus} RCN
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View className="h-px bg-gray-800 mb-4" />

        {/* Reward Breakdown */}
        <View className="mb-3">
          <Text className="text-gray-400 text-sm mb-3">Potential Earnings</Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-500">Base Reward</Text>
            <Text className="text-white">{reward.base} RCN</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-500">Tier Bonus ({tierInfo.tier})</Text>
            <Text className="text-green-400">+{reward.bonus} RCN</Text>
          </View>
          <View className="h-px bg-gray-700 my-2" />
          <View className="flex-row justify-between">
            <Text className="text-white font-semibold">Total Reward</Text>
            <Text className="text-[#FFCC00] font-bold text-lg">
              {reward.total} RCN
            </Text>
          </View>
        </View>

        {/* Info Note */}
        <View className="bg-[#FFCC00]/10 rounded-lg p-3 flex-row items-start">
          <Ionicons name="information-circle" size={18} color="#FFCC00" />
          <Text className="text-gray-400 text-xs ml-2 flex-1">
            Earn RCN tokens when you complete this service. Higher tiers unlock
            better rewards!
          </Text>
        </View>
      </View>
    </View>
  );
}
