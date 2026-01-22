import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShopWithLocation } from "../types";

interface ShopCardProps {
  shop: ShopWithLocation;
  onPress: () => void;
}

export function ShopCard({ shop, onPress }: ShopCardProps) {
  return (
    <Pressable onPress={onPress} className="bg-zinc-800 rounded-2xl p-4 mb-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-white text-lg font-semibold flex-1" numberOfLines={1}>
              {shop.name || "Unknown Shop"}
            </Text>
            {!shop.hasValidLocation && (
              <View className="bg-zinc-700 px-2 py-0.5 rounded-full ml-2">
                <Text className="text-gray-400 text-xs">No location</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-400 text-sm mt-1" numberOfLines={2}>
            {shop.address || "No address available"}
          </Text>
        </View>
        {shop.distance && shop.hasValidLocation && (
          <View className="bg-[#FFCC00]/20 px-3 py-1 rounded-full ml-2">
            <Text className="text-[#FFCC00] text-sm font-medium">
              {shop.distance.toFixed(1)} mi
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center mt-3 gap-4">
        {shop.verified && (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text className="text-green-500 text-xs ml-1">Verified</Text>
          </View>
        )}
        {shop.crossShopEnabled && (
          <View className="flex-row items-center">
            <Ionicons name="swap-horizontal" size={16} color="#60A5FA" />
            <Text className="text-blue-400 text-xs ml-1">Cross-shop</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
