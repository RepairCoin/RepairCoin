import { View, Text } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TierConfig } from "../types";

interface TierBenefitsProps {
  tierConfig: TierConfig;
}

export function TierBenefits({ tierConfig }: TierBenefitsProps) {
  return (
    <View className="mt-6">
      <Text className="text-white text-lg font-bold mb-3">Your Benefits</Text>
      <View className="rounded-3xl overflow-hidden">
        <LinearGradient
          colors={["#121212", "#373737"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 2, y: 0 }}
          className="p-4"
        >
          {tierConfig.benefits.map((benefit, index) => (
            <View key={index} className="flex-row items-center mb-3 last:mb-2">
              <View className="bg-[#FFCC00] rounded-full p-1 mr-3">
                <Ionicons name="checkmark" size={16} color="#000" />
              </View>
              <Text className="text-[#FFFFFF] flex-1">{benefit}</Text>
            </View>
          ))}
          {tierConfig.bonus > 0 && (
            <View className="mt-3 pt-3 border-t border-zinc-500">
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="plus-circle" size={20} color="#FFCC00" />
                <Text className="text-[#FFCC00] ml-4">
                  +{tierConfig.bonus} RCN bonus on every reward
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </View>
    </View>
  );
}
