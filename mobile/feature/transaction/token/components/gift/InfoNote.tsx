import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function InfoNote() {
  return (
    <View className="flex-row items-start mt-4 mb-8">
      <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
      <Text className="text-gray-400 text-sm ml-2 flex-1">
        Gifted tokens will be transferred instantly and cannot be reversed. Make
        sure the recipient address is correct.
      </Text>
    </View>
  );
}
