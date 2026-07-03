import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import {
  SERVICE_CATEGORIES,
  ServiceCategory,
} from "@/shared/constants/service-categories";

const CATEGORY_ICONS: Record<ServiceCategory, keyof typeof Ionicons.glyphMap> = {
  repairs: "construct",
  beauty_personal_care: "sparkles",
  health_wellness: "heart",
  fitness_gyms: "barbell",
  automotive_services: "car-sport",
  home_cleaning_services: "home",
  pets_animal_care: "paw",
  professional_services: "briefcase",
  education_classes: "school",
  tech_it_services: "hardware-chip",
  food_beverage: "restaurant",
  other_local_services: "grid",
};

interface CategoryGridProps {
  /** Number of categories to show before "See All" (default 8). */
  limit?: number;
}

/**
 * V2 "Explore Service Categories" grid. Each tile opens the category-scoped
 * Per Industry Page (`/customer/service/category/[category]`).
 */
function CategoryGrid({ limit = 8 }: CategoryGridProps) {
  const categories = SERVICE_CATEGORIES.slice(0, limit);

  return (
    <View>
      <SectionHeader
        title="Explore Service Categories"
        onSeeAll={() => router.navigate("/customer/tabs/service")}
      />
      <View className="flex-row flex-wrap -mx-1">
        {categories.map((cat) => (
          <Pressable
            key={cat.value}
            onPress={() =>
              router.push(`/customer/service/category/${cat.value}`)
            }
            className="w-1/4 px-1 mb-3"
          >
            {/* TODO(wire-later): swap icon tile for real category photo. */}
            <View
              className="w-full aspect-square rounded-2xl bg-zinc-900 items-center justify-center border border-zinc-800"
            >
              <Ionicons
                name={CATEGORY_ICONS[cat.value]}
                size={30}
                color="#FFCC00"
              />
            </View>
            <Text
              className="text-white text-[11px] text-center mt-1.5"
              numberOfLines={2}
            >
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default React.memo(CategoryGrid);
