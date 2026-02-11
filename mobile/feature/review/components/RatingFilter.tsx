import { Text, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface RatingFilterProps {
  selectedRating: number | null;
  onSelect: (rating: number | null) => void;
}

const FILTERS = [
  { label: "All", value: null },
  { label: "5 Star", value: 5 },
  { label: "4 Star", value: 4 },
  { label: "3 Star", value: 3 },
  { label: "2 Star", value: 2 },
  { label: "1 Star", value: 1 },
];

export default function RatingFilter({
  selectedRating,
  onSelect,
}: RatingFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {FILTERS.map((filter) => {
        const isSelected = selectedRating === filter.value;

        return (
          <TouchableOpacity
            key={filter.label}
            onPress={() => onSelect(filter.value)}
            className={`flex-row items-center px-4 py-2 rounded-full ${
              isSelected ? "bg-[#FFCC00]" : "bg-zinc-800"
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
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
