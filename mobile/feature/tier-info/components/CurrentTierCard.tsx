import { View, Text } from "react-native";
import { SimpleLineIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TierConfig, TierProgress } from "../types";

interface CurrentTierCardProps {
  tierProgress: TierProgress;
  currentTierConfig: TierConfig;
}

export function CurrentTierCard({ tierProgress, currentTierConfig }: CurrentTierCardProps) {
  const { nextTier, nextTierConfig, progressToNextTier, rcnToNextTier, lifetimeEarnings } = tierProgress;

  return (
    <View className="mt-2 rounded-2xl overflow-hidden">
      <LinearGradient
        colors={currentTierConfig.color}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-5"
      >
        <View className="flex-row items-center justify-between m-2">
          <View>
            <Text className="text-black/60 text-sm font-medium">Your Current Tier</Text>
            <Text className="text-black text-3xl font-bold mt-1">
              {currentTierConfig.label}
            </Text>
          </View>
          <View className="bg-black/20 rounded-full p-3">
            <SimpleLineIcons name="badge" size={28} color="#000" />
          </View>
        </View>

        {/* Progress to next tier */}
        {nextTier && nextTierConfig && (
          <View className="mt-5">
            <View className="flex-row justify-between mb-2">
              <Text className="text-black/70 text-sm">
                Progress to {nextTierConfig.label}
              </Text>
              <Text className="text-black font-semibold">{rcnToNextTier} RCN to go</Text>
            </View>
            <View className="bg-black/20 rounded-full h-2.5">
              <View
                className="bg-black rounded-full h-2.5"
                style={{ width: `${progressToNextTier}%` }}
              />
            </View>
            <Text className="text-black/60 text-xs mt-1.5 text-center">
              {lifetimeEarnings} / {nextTierConfig.requirement} RCN lifetime earnings
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
  );
}
