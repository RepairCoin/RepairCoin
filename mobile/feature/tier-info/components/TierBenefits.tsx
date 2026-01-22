import { View, Text } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { TierConfig } from "../types";

interface TierBenefitsProps {
  tierConfig: TierConfig;
}

export function TierBenefits({ tierConfig }: TierBenefitsProps) {
  return (
    <View className="mt-6">
      <Text className="text-white text-lg font-bold mb-3">Your Benefits</Text>
      <View className="bg-zinc-900 rounded-xl p-4">
        {tierConfig.benefits.map((benefit, index) => (
          <View key={index} className="flex-row items-center mb-3 last:mb-2">
            <View className="bg-green-500/20 rounded-full p-1 mr-3">
              <Ionicons name="checkmark" size={16} color="#22C55E" />
            </View>
            <Text className="text-gray-300 flex-1">{benefit}</Text>
          </View>
        ))}
        {tierConfig.bonus > 0 && (
          <View className="mt-3 pt-3 border-t border-zinc-800">
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="plus-circle" size={20} color="#FFCC00" />
              <Text className="text-[#FFCC00] font-semibold ml-2">
                +{tierConfig.bonus} RCN bonus on every reward
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
