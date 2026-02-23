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
      <View
        className="bg-zinc-900 px-4 py-2.5 rounded-xl border border-zinc-800 flex-row items-center"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        }}
      >
        <View className="w-6 h-6 rounded-full bg-[#FFCC00]/20 items-center justify-center mr-2">
          <Ionicons name="storefront" size={12} color="#FFCC00" />
        </View>
        <Text className="text-white text-sm font-semibold">
          {shopsInRadius}
        </Text>
        <Text className="text-zinc-500 text-sm ml-1">
          within {radiusMiles} mi
        </Text>
      </View>

      {/* Radius control */}
      <View
        className="bg-zinc-900 rounded-xl flex-row items-center border border-zinc-800"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        }}
      >
        <Pressable
          onPress={onDecrease}
          className="px-3 py-2.5 active:bg-zinc-800 rounded-l-xl"
        >
          <Ionicons name="remove" size={20} color="#FFCC00" />
        </Pressable>
        <View className="px-3 py-2.5 border-x border-zinc-800">
          <Text className="text-[#FFCC00] text-sm font-bold min-w-[45px] text-center">
            {radiusMiles} mi
          </Text>
        </View>
        <Pressable
          onPress={onIncrease}
          className="px-3 py-2.5 active:bg-zinc-800 rounded-r-xl"
        >
          <Ionicons name="add" size={20} color="#FFCC00" />
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
      className="absolute right-4 bottom-12 bg-zinc-900 w-12 h-12 rounded-xl items-center justify-center border border-zinc-800 active:bg-zinc-800"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
      }}
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
    <View className="flex-row bg-zinc-900 rounded-xl p-1 border border-zinc-800">
      <Pressable
        onPress={onMapPress}
        className={`flex-row items-center px-3 py-2 rounded-lg ${viewMode === "map" ? "bg-[#FFCC00]" : ""}`}
      >
        <Ionicons
          name="map"
          size={16}
          color={viewMode === "map" ? "#000" : "#71717a"}
        />
        <Text
          className={`text-sm font-medium ml-1.5 ${viewMode === "map" ? "text-black" : "text-zinc-500"}`}
        >
          Map
        </Text>
      </Pressable>
      <Pressable
        onPress={onListPress}
        className={`flex-row items-center px-3 py-2 rounded-lg ${viewMode === "list" ? "bg-[#FFCC00]" : ""}`}
      >
        <Ionicons
          name="list"
          size={16}
          color={viewMode === "list" ? "#000" : "#71717a"}
        />
        <Text
          className={`text-sm font-medium ml-1.5 ${viewMode === "list" ? "text-black" : "text-zinc-500"}`}
        >
          List
        </Text>
      </Pressable>
    </View>
  );
}
