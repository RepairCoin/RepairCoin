import { TouchableOpacity, Text } from "react-native";

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

export function FilterChip({ label, isActive, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-2 rounded-full mr-2 ${
        isActive ? "bg-[#FFCC00]" : "bg-zinc-800"
      }`}
      activeOpacity={0.7}
    >
      <Text
        className={`text-sm font-medium ${
          isActive ? "text-black" : "text-gray-400"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
