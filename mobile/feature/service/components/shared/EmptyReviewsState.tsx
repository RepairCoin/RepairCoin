import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EmptyReviewsStateProps {
  hasFilter: boolean;
}

export default function EmptyReviewsState({ hasFilter }: EmptyReviewsStateProps) {
  return (
    <View className="items-center justify-center py-16 px-4">
      <Ionicons name="chatbubble-ellipses-outline" size={48} color="#4B5563" />
      <Text className="text-gray-400 text-lg mt-4 font-medium">
        {hasFilter ? "No reviews with this rating" : "No reviews yet"}
      </Text>
      <Text className="text-gray-500 text-sm mt-1 text-center">
        {hasFilter
          ? "Try selecting a different rating filter"
          : "Be the first to share your experience!"}
      </Text>
    </View>
  );
}
