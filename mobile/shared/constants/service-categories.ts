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
