import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AdditionalInfoSectionProps {
  createdAt: string;
  updatedAt?: string;
  formatDate: (date: string) => string;
}

export function AdditionalInfoSection({
  createdAt,
  updatedAt,
  formatDate,
}: AdditionalInfoSectionProps) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center mb-4">
        <Ionicons name="information-circle-outline" size={22} color="#FFCC00" />
        <Text className="text-white text-lg font-semibold ml-2">
          Additional Information
        </Text>
      </View>

      <View className="flex-row items-center mb-3">
        <View className="bg-gray-800 rounded-full p-2 mr-3">
          <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
        </View>
        <View>
          <Text className="text-gray-500 text-xs">Created On</Text>
          <Text className="text-white text-base">{formatDate(createdAt)}</Text>
        </View>
      </View>

      {updatedAt && (
        <View className="flex-row items-center">
          <View className="bg-gray-800 rounded-full p-2 mr-3">
            <Ionicons name="refresh-outline" size={20} color="#9CA3AF" />
          </View>
          <View>
            <Text className="text-gray-500 text-xs">Last Updated</Text>
            <Text className="text-white text-base">{formatDate(updatedAt)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
