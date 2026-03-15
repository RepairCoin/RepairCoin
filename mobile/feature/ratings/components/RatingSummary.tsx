import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ReviewStats } from "@/shared/interfaces/review.interface";

interface RatingSummaryProps {
  stats: ReviewStats;
}

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? "star" : "star-outline"}
          size={size}
          color={star <= rating ? "#FFCC00" : "#4B5563"}
        />
      ))}
    </View>
  );
}

export default function RatingSummary({ stats }: RatingSummaryProps) {
  return (
    <View className="bg-[#1a1a1a] rounded-xl p-4 mx-4 mb-4">
      <View className="flex-row items-center">
        <View className="items-center mr-6">
          <Text className="text-white text-4xl font-bold">
            {stats.averageRating.toFixed(1)}
          </Text>
          <StarDisplay rating={Math.round(stats.averageRating)} />
          <Text className="text-gray-500 text-sm mt-1">
            {stats.totalReviews} {stats.totalReviews === 1 ? "review" : "reviews"}
          </Text>
        </View>

        <View className="flex-1">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count =
              stats.ratingDistribution[
                rating as keyof typeof stats.ratingDistribution
              ] || 0;
            const percentage =
              stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
            return (
              <View key={rating} className="flex-row items-center mb-1.5">
                <Text className="text-gray-400 text-xs w-4">{rating}</Text>
                <Ionicons
                  name="star"
                  size={12}
                  color="#FFCC00"
                  style={{ marginHorizontal: 4 }}
                />
                <View className="flex-1 h-2 bg-[#333] rounded-full">
                  <View
                    className="h-full bg-[#FFCC00] rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </View>
                <Text className="text-gray-500 text-xs w-8 text-right">
                  {count}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
