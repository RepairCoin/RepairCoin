import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ReviewStats } from "@/shared/interfaces/review.interface";

interface RatingFilterProps {
  selectedRating: number | null;
  onSelect: (rating: number | null) => void;
  stats: ReviewStats | null;
}

const FILTERS = [
  { label: "All", value: null },
  { label: "5", value: 5 },
  { label: "4", value: 4 },
  { label: "3", value: 3 },
  { label: "2", value: 2 },
  { label: "1", value: 1 },
];

export default function RatingFilter({
  selectedRating,
  onSelect,
  stats,
}: RatingFilterProps) {
  return (
    <View className="mb-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FILTERS.map((filter) => {
          const isSelected = selectedRating === filter.value;
          const count =
            filter.value === null
              ? stats?.totalReviews || 0
              : stats?.ratingDistribution[
                  filter.value as keyof typeof stats.ratingDistribution
                ] || 0;

          return (
            <TouchableOpacity
              key={filter.label}
              onPress={() => onSelect(filter.value)}
              className={`flex-row items-center px-4 py-2 rounded-full ${
                isSelected ? "bg-[#FFCC00]" : "bg-[#1a1a1a]"
              }`}
              activeOpacity={0.7}
            >
              {filter.value !== null && (
                <Ionicons
                  name="star"
                  size={14}
                  color={isSelected ? "#000" : "#FFCC00"}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                className={`font-medium ${
                  isSelected ? "text-black" : "text-white"
                }`}
              >
                {filter.label}
              </Text>
              <Text
                className={`ml-1 text-xs ${
                  isSelected ? "text-black/60" : "text-gray-500"
                }`}
              >
                ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
