export type ServiceCategory =
  | "repairs"
  | "beauty_personal_care"
  | "health_wellness"
  | "fitness_gyms"
  | "automotive_services"
  | "home_cleaning_services"
  | "pets_animal_care"
  | "professional_services"
  | "education_classes"
  | "tech_it_services"
  | "food_beverage"
  | "other_local_services";

import type { Ionicons } from "@expo/vector-icons";

/** Default Ionicons glyph per service category (used for icon fallbacks). */
export const CATEGORY_ICONS: Record<
  ServiceCategory,
  keyof typeof Ionicons.glyphMap
> = {
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

/** Fallback icon for unknown/missing categories. */
export const DEFAULT_CATEGORY_ICON: keyof typeof Ionicons.glyphMap =
  "storefront";

/** Resolve a category string to its icon, falling back to a safe default. */
export function getCategoryIcon(
  category?: string | null
): keyof typeof Ionicons.glyphMap {
  if (category && category in CATEGORY_ICONS) {
    return CATEGORY_ICONS[category as ServiceCategory];
  }
  return DEFAULT_CATEGORY_ICON;
}

export const SERVICE_CATEGORIES: Array<{
  value: ServiceCategory;
  label: string;
}> = [
  { value: "repairs", label: "Repairs" },
  { value: "beauty_personal_care", label: "Beauty & Personal Care" },
  { value: "health_wellness", label: "Health & Wellness" },
  { value: "fitness_gyms", label: "Fitness & Gyms" },
  { value: "automotive_services", label: "Automotive Services" },
  { value: "home_cleaning_services", label: "Home & Cleaning Services" },
  { value: "pets_animal_care", label: "Pets & Animal Care" },
  { value: "professional_services", label: "Professional Services" },
  { value: "education_classes", label: "Education & Classes" },
  { value: "tech_it_services", label: "Tech & IT Services" },
  { value: "food_beverage", label: "Food & Beverage" },
  { value: "other_local_services", label: "Other Local Services" },
];
