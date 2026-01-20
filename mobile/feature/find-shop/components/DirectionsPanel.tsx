import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShopWithLocation } from "../types";

interface DirectionsPanelMinimizedProps {
  shop: ShopWithLocation;
  routeDistance: number | null;
  routeDuration: number | null;
  onExpand: () => void;
  metersToMiles: (meters: number) => number;
  formatDuration: (seconds: number) => string;
}

export function DirectionsPanelMinimized({
  shop,
  routeDistance,
  routeDuration,
  onExpand,
  metersToMiles,
  formatDuration,
}: DirectionsPanelMinimizedProps) {
  return (
    <Pressable
      onPress={onExpand}
      className="absolute bottom-24 mx-20 bg-[#FFCC00] rounded-2xl px-4 py-3 flex-row items-center"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
      }}
    >
      <View className="bg-black/20 w-10 h-10 rounded-full items-center justify-center mr-3">
        <Ionicons name="navigate" size={20} color="#000" />
      </View>
      <View className="flex-1 mr-3">
        <Text className="text-black font-bold" numberOfLines={1}>
          {shop.name || "Navigation"}
        </Text>
        <Text className="text-black/70 text-sm">
          {routeDistance
            ? metersToMiles(routeDistance).toFixed(1) + " mi"
            : shop.distance
              ? shop.distance.toFixed(1) + " mi"
              : ""}
          {routeDuration ? " • " + formatDuration(routeDuration) : ""}
        </Text>
      </View>
      <Ionicons name="chevron-up" size={20} color="#000" />
    </Pressable>
  );
}

interface DirectionsPanelExpandedProps {
  shop: ShopWithLocation;
  routeDistance: number | null;
  routeDuration: number | null;
  isLoadingRoute: boolean;
  routeCoordinatesLength: number;
  onMinimize: () => void;
  onClose: () => void;
  metersToMiles: (meters: number) => number;
  formatDuration: (seconds: number) => string;
}

export function DirectionsPanelExpanded({
  shop,
  routeDistance,
  routeDuration,
  isLoadingRoute,
  routeCoordinatesLength,
  onMinimize,
  onClose,
  metersToMiles,
  formatDuration,
}: DirectionsPanelExpandedProps) {
  return (
    <View className="absolute bottom-24 left-5 right-5">
      <View className="bg-zinc-900 rounded-2xl p-4 border border-[#FFCC00]">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <View className="bg-[#FFCC00] w-8 h-8 rounded-full items-center justify-center mr-2">
              <Ionicons name="navigate" size={16} color="#000" />
            </View>
            <Text className="text-[#FFCC00] font-semibold">Navigation</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable onPress={onMinimize} className="bg-zinc-800 p-2 rounded-full">
              <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
            </Pressable>
            <Pressable onPress={onClose} className="bg-zinc-800 px-3 py-1.5 rounded-full">
              <Text className="text-gray-300 text-sm">Exit</Text>
            </Pressable>
          </View>
        </View>

        {/* Destination Info */}
        <View className="bg-zinc-800 rounded-xl p-3">
          <Text className="text-gray-400 text-xs mb-1">Destination</Text>
          <Text className="text-white font-semibold" numberOfLines={1}>
            {shop.name || "Unknown Shop"}
          </Text>
          <Text className="text-gray-400 text-sm mt-1" numberOfLines={1}>
            {shop.address || "No address"}
          </Text>
        </View>

        {/* Route Info */}
        {isLoadingRoute ? (
          <View className="flex-row items-center justify-center mt-3 bg-zinc-800 py-4 rounded-xl">
            <ActivityIndicator size="small" color="#FFCC00" />
            <Text className="text-gray-400 ml-2">Calculating route...</Text>
          </View>
        ) : (
          <View className="flex-row mt-3 gap-2">
            {/* Distance */}
            <View className="flex-1 bg-[#FFCC00]/20 py-3 rounded-xl items-center">
              <Ionicons name="speedometer-outline" size={20} color="#FFCC00" />
              <Text className="text-[#FFCC00] text-lg font-bold mt-1">
                {routeDistance
                  ? metersToMiles(routeDistance).toFixed(1) + " mi"
                  : shop.distance
                    ? shop.distance.toFixed(1) + " mi"
                    : "N/A"}
              </Text>
              <Text className="text-gray-400 text-xs">Distance</Text>
            </View>
            {/* Duration */}
            <View className="flex-1 bg-[#FFCC00]/20 py-3 rounded-xl items-center">
              <Ionicons name="time-outline" size={20} color="#FFCC00" />
              <Text className="text-[#FFCC00] text-lg font-bold mt-1">
                {routeDuration ? formatDuration(routeDuration) : "N/A"}
              </Text>
              <Text className="text-gray-400 text-xs">Est. Time</Text>
            </View>
          </View>
        )}

        {/* Hint */}
        <Text className="text-gray-500 text-xs text-center mt-3">
          {routeCoordinatesLength > 2
            ? "Follow the yellow route on the map"
            : "Route shown as direct path"}
        </Text>
      </View>
    </View>
  );
}
