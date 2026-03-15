import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { STAR_COUNT } from "../constants";
import { RatingLevel } from "../types";

interface StarRatingProps {
  rating: RatingLevel;
  ratingText: string;
  onSelectRating: (star: RatingLevel) => void;
}

export default function StarRating({
  rating,
  ratingText,
  onSelectRating,
}: StarRatingProps) {
  return (
    <View className="mb-6">
      <Text className="text-white text-lg font-semibold mb-4 text-center">
        How was your experience?
      </Text>

      <View className="flex-row justify-center gap-2">
        {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onSelectRating(star as RatingLevel)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={40}
              color={star <= rating ? "#FFCC00" : "#6B7280"}
            />
          </TouchableOpacity>
        ))}
      </View>

      <Text
        className={`text-center mt-3 text-lg font-medium ${
          rating > 0 ? "text-[#FFCC00]" : "text-gray-500"
        }`}
      >
        {ratingText}
      </Text>
    </View>
  );
}
