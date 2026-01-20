import { View, Text } from "react-native";
import { CustomerData, CustomerTier } from "../types";
import { TIER_STYLES } from "../constants";

interface CustomerInfoCardProps {
  customerInfo: CustomerData;
}

export default function CustomerInfoCard({ customerInfo }: CustomerInfoCardProps) {
  const tier = customerInfo.tier as CustomerTier;

  return (
    <View className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-700">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className={`px-3 py-1 rounded-full mr-3 ${TIER_STYLES[tier]}`}>
            <Text className="text-white text-xs font-bold">
              {customerInfo.tier}
            </Text>
          </View>
          <View>
            <Text className="text-gray-400 text-xs">Lifetime Earnings</Text>
            <Text className="text-white font-semibold">
              {customerInfo.lifetimeEarnings} RCN
            </Text>
          </View>
        </View>
        <View className="bg-green-500/20 px-2 py-1 rounded-full">
          <Text className="text-green-400 text-xs font-semibold">
            ✓ No Limits
          </Text>
        </View>
      </View>
    </View>
  );
}
