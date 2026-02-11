import { View, Text, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShopWithLocation } from "../types";
import {
  getTodayAvailability,
  formatShopHours,
  getShopStatus,
} from "../utils";

interface ShopCardProps {
  shop: ShopWithLocation;
  onPress: () => void;
}

export function ShopCard({ shop, onPress }: ShopCardProps) {
  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case "elite":
        return { bg: "bg-purple-500/20", text: "text-purple-400" };
      case "premium":
        return { bg: "bg-blue-500/20", text: "text-blue-400" };
      default:
        return { bg: "bg-[#FFCC00]/20", text: "text-[#FFCC00]" };
    }
  };

  const tierColors = getTierColor(shop.rcg_tier);
  const todayAvailability = shop.availability
    ? getTodayAvailability(shop.availability)
    : null;
  const shopStatus = getShopStatus(todayAvailability);
  const hoursText = formatShopHours(todayAvailability);

  return (
    <Pressable
      onPress={onPress}
      className="bg-zinc-900 rounded-2xl mb-3 overflow-hidden border border-zinc-800 active:border-[#FFCC00]/50"
    >
      <View className="p-4 flex-row">
        {/* Shop Logo */}
        <View className="w-14 h-14 rounded-full overflow-hidden bg-zinc-800">
          {shop.logoUrl ? (
            <Image
              source={{ uri: shop.logoUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-[#FFCC00]/10">
              <Ionicons name="storefront" size={24} color="#FFCC00" />
            </View>
          )}
        </View>

        {/* Shop Info */}
        <View className="flex-1 ml-3 overflow-hidden">
          {/* Name Row */}
          <View className="flex-row items-center">
            <Text
              className="text-white text-base font-semibold flex-1"
              numberOfLines={1}
            >
              {shop.name || "Unknown Shop"}
            </Text>
            {shop.verified && (
              <Ionicons name="checkmark-circle" size={14} color="#22C55E" style={{ marginLeft: 4 }} />
            )}
            {shop.distance !== undefined && shop.hasValidLocation && (
              <View className="bg-[#FFCC00] px-2 py-0.5 rounded-full ml-2">
                <Text className="text-black text-xs font-bold">
                  {shop.distance.toFixed(1)} mi
                </Text>
              </View>
            )}
          </View>

          {/* Address */}
          <View className="flex-row items-center mt-1">
            <Ionicons name="location-outline" size={12} color="#71717a" />
            <Text className="text-zinc-500 text-xs ml-1 flex-1" numberOfLines={1}>
              {shop.address || "No address available"}
            </Text>
          </View>

          {/* Hours Row */}
          <View className="flex-row items-center mt-1">
            <Ionicons name="time-outline" size={12} color="#71717a" />
            <Text className="text-zinc-500 text-xs ml-1">{hoursText}</Text>
            <View
              className="ml-2 px-2 py-0.5 rounded-full"
              style={{ backgroundColor: shopStatus.isOpen ? "#22C55E20" : "#EF444420" }}
            >
              <Text
                className="text-[10px] font-medium"
                style={{ color: shopStatus.color }}
              >
                {shopStatus.text}
              </Text>
            </View>
          </View>

          {/* Tags Row */}
          <View className="flex-row items-center mt-2 gap-2 flex-wrap">
            {shop.rcg_tier && (
              <View className={`${tierColors.bg} px-2 py-0.5 rounded-full`}>
                <Text className={`${tierColors.text} text-[10px] font-medium capitalize`}>
                  {shop.rcg_tier}
                </Text>
              </View>
            )}
            {shop.crossShopEnabled && (
              <View className="bg-blue-500/20 px-2 py-0.5 rounded-full flex-row items-center">
                <Ionicons name="swap-horizontal" size={10} color="#60A5FA" />
                <Text className="text-blue-400 text-[10px] ml-1">Cross-shop</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
