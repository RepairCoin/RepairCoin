import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

interface AiSearchBarProps {
  onPress?: () => void;
  placeholder?: string;
}

/**
 * V2 "Ask FixFlow anything" AI entry bar. Presentational for now — onPress
 * routes to the AI assistant surface (wired to a placeholder until the mobile
 * AI chat screen exists).
 */
function AiSearchBar({
  onPress,
  placeholder = "Ask FixFlow anything..",
}: AiSearchBarProps) {
  return (
    <Pressable
      onPress={onPress}
      className="mt-4 flex-row items-center rounded-full px-4 py-3.5 bg-zinc-900 border border-[#FFCC00]/60"
    >
      <MaterialCommunityIcons name="star-four-points" size={18} color="#FFCC00" />
      <Text className="flex-1 text-zinc-400 text-sm ml-3">{placeholder}</Text>
      <View className="w-8 h-8 rounded-full bg-[#FFCC00] items-center justify-center">
        <Ionicons name="mic" size={16} color="#000" />
      </View>
    </Pressable>
  );
}

export default React.memo(AiSearchBar);
