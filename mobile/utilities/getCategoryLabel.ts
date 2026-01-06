import { SERVICE_CATEGORIES } from "@/constants/service-categories";

export const getCategoryLabel = (category?: string): string => {
  if (!category) return "Other";
  const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
  return cat?.label || category;
};
