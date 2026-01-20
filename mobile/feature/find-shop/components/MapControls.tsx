import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface RadiusControlProps {
  radiusMiles: number;
  shopsInRadius: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

export function RadiusControl({
  radiusMiles,
  shopsInRadius,
  onIncrease,
  onDecrease,
}: RadiusControlProps) {
  return (
    <View className="absolute top-4 left-4 right-4 flex-row items-center justify-between">
      {/* Shop count badge */}
      <View className="bg-zinc-900/90 px-3 py-2 rounded-full">
        <Text className="text-white text-sm font-medium">
          {shopsInRadius} shops within {radiusMiles} mi
        </Text>
      </View>

      {/* Radius control */}
      <View className="bg-zinc-900/90 rounded-full flex-row items-center">
        <Pressable onPress={onDecrease} className="px-3 py-2">
          <Ionicons name="remove" size={18} color="#FFCC00" />
        </Pressable>
        <View className="px-2 py-2 border-x border-zinc-700">
          <Text className="text-[#FFCC00] text-sm font-bold min-w-[40px] text-center">
            {radiusMiles} mi
          </Text>
        </View>
        <Pressable onPress={onIncrease} className="px-3 py-2">
          <Ionicons name="add" size={18} color="#FFCC00" />
        </Pressable>
      </View>
    </View>
  );
}

interface CenterLocationButtonProps {
  onPress: () => void;
}

export function CenterLocationButton({ onPress }: CenterLocationButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="absolute right-4 bottom-12 bg-zinc-900 w-12 h-12 rounded-full items-center justify-center border border-zinc-700"
    >
      <Ionicons name="locate" size={24} color="#FFCC00" />
    </Pressable>
  );
}

interface ViewModeToggleProps {
  viewMode: "map" | "list";
  onMapPress: () => void;
  onListPress: () => void;
}

export function ViewModeToggle({ viewMode, onMapPress, onListPress }: ViewModeToggleProps) {
  return (
    <View className="flex-row bg-zinc-800 rounded-full p-1">
      <Pressable
        onPress={onMapPress}
        className={`px-4 py-1.5 rounded-full ${viewMode === "map" ? "bg-[#FFCC00]" : ""}`}
      >
        <Ionicons name="map" size={18} color={viewMode === "map" ? "#000" : "#9CA3AF"} />
      </Pressable>
      <Pressable
        onPress={onListPress}
        className={`px-4 py-1.5 rounded-full ${viewMode === "list" ? "bg-[#FFCC00]" : ""}`}
      >
        <Ionicons name="list" size={18} color={viewMode === "list" ? "#000" : "#9CA3AF"} />
      </Pressable>
    </View>
  );
}
