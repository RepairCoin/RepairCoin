import { View, Text } from "react-native";
import { Ionicons, SimpleLineIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Tier } from "@/utilities/GlobalTypes";
import { TierConfig } from "../types";

interface AllTiersOverviewProps {
  tierOrder: Tier[];
  tierConfig: Record<Tier, TierConfig>;
  currentTier: Tier;
  isTierUnlocked: (tier: Tier) => boolean;
}

export function AllTiersOverview({
  tierOrder,
  tierConfig,
  currentTier,
  isTierUnlocked,
}: AllTiersOverviewProps) {
  return (
    <View className="mt-6 mb-8">
      <Text className="text-white text-lg font-bold mb-3">All Tiers</Text>
      {tierOrder.map((tier) => {
        const config = tierConfig[tier];
        const isCurrentTier = tier === currentTier;
        const isUnlocked = isTierUnlocked(tier);

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
  );
}
