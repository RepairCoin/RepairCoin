import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AdditionalInfoSectionProps {
  createdAt: string;
  formatDate: (date: string) => string;
}

export function AdditionalInfoSection({
  createdAt,
  formatDate,
}: AdditionalInfoSectionProps) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center mb-4">
        <Text className="text-white text-lg font-semibold ml-2">
          Additional Information
        </Text>
      </View>

      <View className="flex-row items-center">
        <View className="bg-gray-800 rounded-full p-2 mr-3">
          <Ionicons name="calendar-outline" size={20} color="#FFCC00" />
        </View>
        <View>
          <Text className="text-gray-500 text-xs">Listed On</Text>
          <Text className="text-white text-base">{formatDate(createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}
