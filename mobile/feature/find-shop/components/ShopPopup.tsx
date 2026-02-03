import { View, Text, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShopWithLocation } from "../types";

interface ShopPopupMinimizedProps {
  shop: ShopWithLocation;
  onExpand: () => void;
}

export function ShopPopupMinimized({ shop, onExpand }: ShopPopupMinimizedProps) {
  return (
    <Pressable
      onPress={onExpand}
      className="absolute bottom-28 left-4 right-4 bg-zinc-900 rounded-2xl px-4 py-3 flex-row items-center border border-zinc-800"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      {/* Shop Logo */}
      <View className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800">
        {shop.logoUrl ? (
          <Image
            source={{ uri: shop.logoUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center bg-[#FFCC00]/10">
            <Ionicons name="storefront" size={22} color="#FFCC00" />
          </View>
        )}
      </View>

      {/* Shop Info */}
      <View className="flex-1 mx-3">
        <View className="flex-row items-center">
          <Text className="text-white font-bold flex-1" numberOfLines={1}>
            {shop.name || "Unknown Shop"}
          </Text>
          {shop.verified && (
            <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
          )}
        </View>
        <View className="flex-row items-center mt-0.5">
          {shop.distance !== undefined && (
            <View className="flex-row items-center">
              <Ionicons name="navigate" size={12} color="#FFCC00" />
              <Text className="text-[#FFCC00] text-sm font-medium ml-1">
                {shop.distance.toFixed(1)} mi
              </Text>
            </View>
          )}
          {shop.distance !== undefined && shop.address && (
            <Text className="text-zinc-600 mx-1.5">•</Text>
          )}
          <Text className="text-zinc-500 text-sm flex-1" numberOfLines={1}>
            {shop.address || "No address"}
          </Text>
        </View>
      </View>

      {/* Expand Icon */}
      <View className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center">
        <Ionicons name="chevron-up" size={18} color="#FFCC00" />
      </View>
    </Pressable>
  );
}

interface ShopPopupExpandedProps {
  shop: ShopWithLocation;
  onMinimize: () => void;
  onClose: () => void;
  onViewShop: () => void;
  onDirections: () => void;
}

export function ShopPopupExpanded({
  shop,
  onMinimize,
  onClose,
  onViewShop,
  onDirections,
}: ShopPopupExpandedProps) {
  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case "elite":
        return "#A855F7";
      case "premium":
        return "#3B82F6";
      default:
        return "#FFCC00";
    }
  };

  return (
    <View
      className="absolute bottom-28 left-4 right-4 bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      {/* Header Bar */}
      <View className="flex-row items-center justify-end px-4 pt-3 pb-2">
        <Pressable
          onPress={onMinimize}
          className="flex-row items-center"
        >
          <Ionicons name="chevron-down" size={20} color="#71717a" />
          <Text className="text-zinc-500 text-sm ml-1">Minimize</Text>
        </Pressable>
        {/* <Pressable
          onPress={onClose}
          className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center"
        >
          <Ionicons name="close" size={18} color="#9CA3AF" />
        </Pressable> */}
      </View>

      {/* Main Content */}
      <View className="px-4 pb-4">
        <View className="flex-row">
          {/* Shop Logo */}
          <View className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800">
            {shop.logoUrl ? (
              <Image
                source={{ uri: shop.logoUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center bg-[#FFCC00]/10">
                <Ionicons name="storefront" size={36} color="#FFCC00" />
              </View>
            )}
          </View>

          {/* Shop Info */}
          <View className="flex-1 ml-4">
            <View className="flex-row items-center">
              <Text className="text-white text-lg font-bold flex-1" numberOfLines={1}>
                {shop.name || "Unknown Shop"}
              </Text>
              {shop.verified && (
                <View className="flex-row items-center ml-2 bg-green-500/20 px-2 py-0.5 rounded-full">
                  <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                  <Text className="text-green-500 text-xs ml-1">Verified</Text>
                </View>
              )}
            </View>

            {/* Tags */}
            <View className="flex-row items-center mt-2 gap-2">
              {shop.rcg_tier && (
                <View
                  className="px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${getTierColor(shop.rcg_tier)}20` }}
                >
                  <Text
                    className="text-xs font-semibold capitalize"
                    style={{ color: getTierColor(shop.rcg_tier) }}
                  >
                    {shop.rcg_tier}
                  </Text>
                </View>
              )}
              {shop.crossShopEnabled && (
                <View className="bg-blue-500/20 px-2.5 py-1 rounded-full flex-row items-center">
                  <Ionicons name="swap-horizontal" size={12} color="#60A5FA" />
                  <Text className="text-blue-400 text-xs font-medium ml-1">Cross-shop</Text>
                </View>
              )}
            </View>

            {/* Distance */}
            {shop.distance !== undefined && (
              <View className="flex-row items-center mt-2">
                <Ionicons name="navigate" size={14} color="#FFCC00" />
                <Text className="text-[#FFCC00] text-sm font-semibold ml-1">
                  {shop.distance.toFixed(1)} miles away
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Details Section */}
        <View className="mt-4 bg-zinc-800/50 rounded-xl p-3">
          {/* Address */}
          <View className="flex-row items-start">
            <View className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center">
              <Ionicons name="location-outline" size={16} color="#FFCC00" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-zinc-500 text-xs">Address</Text>
              <Text className="text-white text-sm mt-0.5">
                {shop.address || "No address available"}
                {shop.location?.city && `, ${shop.location.city}`}
              </Text>
            </View>
          </View>

          {/* Phone */}
          {shop.phone && (
            <View className="flex-row items-center mt-3 pt-3 border-t border-zinc-700">
              <View className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center">
                <Ionicons name="call-outline" size={16} color="#FFCC00" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-zinc-500 text-xs">Phone</Text>
                <Text className="text-white text-sm mt-0.5">{shop.phone}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-3 mt-4">
          <Pressable
            onPress={onViewShop}
            className="flex-1 bg-zinc-800 py-3.5 rounded-xl flex-row items-center justify-center"
          >
            <Ionicons name="storefront" size={20} color="#FFCC00" />
            <Text className="text-white font-semibold ml-2">View Shop</Text>
          </Pressable>
          <Pressable
            onPress={onDirections}
            className="flex-1 bg-[#FFCC00] py-3.5 rounded-xl flex-row items-center justify-center"
          >
            <Ionicons name="navigate" size={20} color="#000" />
            <Text className="text-black font-semibold ml-2">Directions</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
