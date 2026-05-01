import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";

interface StatusBannerProps {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  bgColor: string;
  borderColor: string;
  title: string;
  subtitle: string;
}

export default function StatusBanner({ icon, color, bgColor, borderColor, title, subtitle }: StatusBannerProps) {
  return (
    <View className="mx-4 mb-8 p-4 rounded-xl" style={{ backgroundColor: bgColor, borderWidth: 1, borderColor }}>
      <View className="flex-row items-center">
        <Feather name={icon} size={24} color={color} />
        <View className="ml-3 flex-1">
          <Text className="font-semibold" style={{ color }}>{title}</Text>
          <Text className="text-sm mt-0.5" style={{ color: color + "B3" }}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}
