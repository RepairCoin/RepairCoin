import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

export function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <View className="flex-row items-center bg-[#FFCC00]/20 px-3 py-1 rounded-full">
      <Text className="text-[#FFCC00] text-xs mr-1">{label}</Text>
      <Pressable onPress={onRemove}>
        <Feather name="x" size={14} color="#FFCC00" />
      </Pressable>
    </View>
  );
}

interface ClearAllFiltersProps {
  onPress: () => void;
}

export function ClearAllFilters({ onPress }: ClearAllFiltersProps) {
  return (
    <Pressable onPress={onPress}>
      <Text className="text-gray-400 text-xs underline py-1">Clear all</Text>
    </Pressable>
  );
}
