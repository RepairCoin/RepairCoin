import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ReviewHeaderProps {
  onBack: () => void;
}

export default function ReviewHeader({ onBack }: ReviewHeaderProps) {
  return (
    <View className="flex-row items-center px-4 pt-14 pb-4 border-b border-gray-800">
      <TouchableOpacity onPress={onBack} className="mr-4">
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <Text className="text-white text-xl font-bold flex-1">Write Review</Text>
    </View>
  );
}
