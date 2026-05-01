import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface InfoBannerProps {
  color: string;
  borderColor: string;
  text: string;
}

export default function InfoBanner({ color, borderColor, text }: InfoBannerProps) {
  return (
    <View className="flex-row items-start p-3 bg-[#1a1a1a] rounded-xl" style={{ borderWidth: 1, borderColor }}>
      <Ionicons name="information-circle" size={20} color={color} />
      <Text className="text-sm ml-2 flex-1" style={{ color }}>{text}</Text>
    </View>
  );
}
