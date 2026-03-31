import { SERVICE_CATEGORIES } from "@/services/api/services";

export const getCategoryLabel = (category?: string) => {
  if (!category) return "Other";
  const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
  return cat?.label || category;
};
