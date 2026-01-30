import { View, Text, Pressable } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { ShopWithLocation } from "../types";

interface ShopPopupMinimizedProps {
  shop: ShopWithLocation;
  onExpand: () => void;
}

export function ShopPopupMinimized({ shop, onExpand }: ShopPopupMinimizedProps) {
  return (
    <Pressable
      onPress={onExpand}
      className="absolute bottom-24 left-5 right-5 bg-zinc-900 rounded-2xl px-4 py-3 flex-row items-center border border-zinc-700"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
      }}
    >
      <View className="bg-[#FFCC00] w-10 h-10 rounded-full items-center justify-center mr-3">
        <Feather name="tool" size={20} color="#000" />
      </View>
      <View className="flex-1 mr-3">
        <Text className="text-white font-bold" numberOfLines={1}>
          {shop.name || "Unknown Shop"}
        </Text>
        <Text className="text-gray-400 text-sm" numberOfLines={1}>
          {shop.distance ? shop.distance.toFixed(1) + " mi away" : shop.address || "No address"}
        </Text>
      </View>
      <Ionicons name="chevron-up" size={20} color="#9CA3AF" />
    </Pressable>
  );
}

interface ShopPopupExpandedProps {
  shop: ShopWithLocation;
  onMinimize: () => void;
  onClose: () => void;
  onCall: () => void;
  onDirections: () => void;
}

export function ShopPopupExpanded({
  shop,
  onMinimize,
  onClose,
  onCall,
  onDirections,
}: ShopPopupExpandedProps) {
  return (
    <View className="absolute bottom-24 left-5 right-5">
      <View className="bg-zinc-900 rounded-2xl p-4 border border-zinc-700">
        {/* Header with minimize and close buttons */}
        <View className="flex-row items-center justify-end gap-2 mb-2">
          <Pressable onPress={onMinimize} className="bg-zinc-800 p-2 rounded-full">
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </Pressable>
          <Pressable onPress={onClose} className="bg-zinc-800 p-2 rounded-full">
            <Ionicons name="close" size={16} color="#9CA3AF" />
          </Pressable>
        </View>

        <View className="flex-row items-start">
          <View className="bg-[#FFCC00] w-12 h-12 rounded-full items-center justify-center mr-3">
            <Feather name="tool" size={24} color="#000" />
          </View>
          <View className="flex-1">
            <Text className="text-white text-lg font-semibold" numberOfLines={1}>
              {shop.name || "Unknown Shop"}
            </Text>
            <Text className="text-gray-400 text-sm mt-1" numberOfLines={2}>
              {shop.address || "No address available"}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mt-3 gap-4">
          {shop.distance && (
            <View className="flex-row items-center">
              <Ionicons name="location" size={16} color="#FFCC00" />
              <Text className="text-gray-300 text-sm ml-1">
                {shop.distance.toFixed(1)} mi away
              </Text>
            </View>
          )}
          {shop.verified && (
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text className="text-green-500 text-sm ml-1">Verified</Text>
            </View>
          )}
        </View>

        <View className="flex-row gap-3 mt-4">
          <Pressable
            onPress={onCall}
            className="flex-1 bg-zinc-800 py-3 rounded-full flex-row items-center justify-center"
          >
            <Ionicons name="call" size={18} color="#FFCC00" />
            <Text className="text-[#FFCC00] font-semibold ml-2">Call</Text>
          </Pressable>
          <Pressable
            onPress={onDirections}
            className="flex-1 bg-[#FFCC00] py-3 rounded-full flex-row items-center justify-center"
          >
            <Ionicons name="navigate" size={18} color="#000" />
            <Text className="text-black font-semibold ml-2">Directions</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
