import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
interface ReviewsHeaderProps {
  onBack: () => void;
}

export default function ReviewsHeader({ onBack }: ReviewsHeaderProps) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-gray-800">
      <TouchableOpacity
        onPress={onBack}
        className="w-10 h-10 items-center justify-center"
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <Text className="text-white text-lg font-semibold ml-2 flex-1">
        Reviews
      </Text>
    </View>
  );
}
