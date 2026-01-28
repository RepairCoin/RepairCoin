import React from "react";
import { TouchableOpacity, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface FilterButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  iconColor?: string;
}

export function FilterButton({
  icon,
  label,
  onPress,
  iconColor = "#FFCC00",
}: FilterButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 flex-row items-center justify-between bg-zinc-900 rounded-xl px-3 py-3"
      activeOpacity={0.7}
    >
      <View className="flex-row items-center">
        <Ionicons name={icon} size={18} color={iconColor} />
        <Text className="text-white text-sm font-medium ml-2">{label}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );
}
