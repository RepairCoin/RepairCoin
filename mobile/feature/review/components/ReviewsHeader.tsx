import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ReviewStats } from "@/shared/interfaces/review.interface";

interface ReviewsHeaderProps {
  stats: ReviewStats | null;
  onBack: () => void;
}

export default function ReviewsHeader({ stats, onBack }: ReviewsHeaderProps) {
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
      {stats && (
        <View className="flex-row items-center">
          <Ionicons name="star" size={16} color="#FFCC00" />
          <Text className="text-white font-medium ml-1">
            {stats.averageRating.toFixed(1)}
          </Text>
          <Text className="text-gray-500 text-sm ml-1">
            ({stats.totalReviews})
          </Text>
        </View>
      )}
    </View>
  );
}
