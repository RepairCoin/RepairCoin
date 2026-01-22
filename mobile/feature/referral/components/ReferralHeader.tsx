import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ReferralHeaderProps {
  onBack: () => void;
}

export default function ReferralHeader({ onBack }: ReferralHeaderProps) {
  return (
    <View className="pt-14 pb-4 px-5">
      <View className="flex-row items-center">
        <Pressable onPress={onBack} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <Text className="text-white text-xl font-bold ml-2">Refer & Earn</Text>
      </View>
    </View>
  );
}
