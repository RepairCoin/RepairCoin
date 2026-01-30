import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function ShopReviewsTab() {
  return (
    <View className="px-4">
      <View className="items-center justify-center py-12">
        <Ionicons name="star-outline" size={48} color="#666" />
        <Text className="text-gray-400 text-lg mt-4">No reviews yet</Text>
        <Text className="text-gray-500 text-sm mt-1">
          Be the first to leave a review
        </Text>
      </View>
    </View>
  );
}
