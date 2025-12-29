import { View, Text } from "react-native";
import { PriceSummaryCardProps } from "../types";

export default function PriceSummaryCard({
  servicePrice,
  rcnValue = 0,
  rcnDiscount = 0,
  finalPrice,
  serviceName,
}: PriceSummaryCardProps) {
  return (
    <View className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
      <Text className="text-gray-400 text-xs uppercase mb-3">
        Price Summary
      </Text>

      {serviceName && (
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-400">Service</Text>
          <Text className="text-white font-medium">{serviceName}</Text>
        </View>
      )}

      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-400">Service Price</Text>
        <Text className="text-white font-medium">
          ${servicePrice.toFixed(2)}
        </Text>
      </View>

      {rcnValue > 0 && (
        <View className="flex-row justify-between mb-2">
          <Text className="text-green-500">
            RCN Discount ({rcnValue.toFixed(2)} RCN)
          </Text>
          <Text className="text-green-500 font-medium">
            -${rcnDiscount.toFixed(2)}
          </Text>
        </View>
      )}

      <View className="h-px bg-zinc-800 my-3" />

      <View className="flex-row justify-between">
        <Text className="text-white text-lg font-semibold">Total</Text>
        <Text className="text-[#FFCC00] text-2xl font-bold">
          ${finalPrice.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}
