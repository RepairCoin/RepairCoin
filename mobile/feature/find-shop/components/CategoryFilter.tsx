import { ScrollView, TouchableOpacity, Text } from "react-native";
import {
  ServiceCategory,
  SERVICE_CATEGORIES,
} from "@/shared/constants/service-categories";

interface CategoryFilterProps {
  selectedCategory: ServiceCategory | null;
  onSelect: (category: ServiceCategory | null) => void;
  shopCategories: Record<string, Set<ServiceCategory>>;
}

export function CategoryFilter({
  selectedCategory,
  onSelect,
  shopCategories,
}: CategoryFilterProps) {
  // Get categories that have at least one shop
  const availableCategories = SERVICE_CATEGORIES.filter((cat) => {
    return Object.values(shopCategories).some((categories) =>
      categories.has(cat.value)
    );
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
      className="mb-4"
    >
      <TouchableOpacity
        onPress={() => onSelect(null)}
        className={`px-4 py-2 rounded-full ${
          selectedCategory === null ? "bg-[#FFCC00]" : "bg-zinc-800"
        }`}
        activeOpacity={0.7}
      >
        <Text
          className={`text-sm font-medium ${
            selectedCategory === null ? "text-black" : "text-white"
          }`}
        >
          All
        </Text>
      </TouchableOpacity>

      {availableCategories.map((category) => {
        const isSelected = selectedCategory === category.value;
        return (
          <TouchableOpacity
            key={category.value}
            onPress={() => onSelect(category.value)}
            className={`px-4 py-2 rounded-full ${
              isSelected ? "bg-[#FFCC00]" : "bg-zinc-800"
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm font-medium ${
                isSelected ? "text-black" : "text-white"
              }`}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
