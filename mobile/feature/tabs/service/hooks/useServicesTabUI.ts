import { useState, useCallback } from "react";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { ServiceStatusFilter } from "./useServicesTabQuery";

export const SERVICE_STATUS_OPTIONS: ServiceStatusFilter[] = ["all", "active", "inactive"];

export function useServicesTabUI() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Toggle category selection
  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setSelectedCategories([]);
  }, []);

  // Check if any filter is active
  const hasActiveFilters = statusFilter !== "all" || selectedCategories.length > 0;

  // Check if search or filter is active (for showing results count)
  const hasSearchOrFilters = searchQuery.length > 0 || hasActiveFilters;

  // Open filter modal
  const openFilterModal = useCallback(() => {
    setFilterModalVisible(true);
  }, []);

  // Close filter modal
  const closeFilterModal = useCallback(() => {
    setFilterModalVisible(false);
  }, []);

  // Clear status filter only
  const clearStatusFilter = useCallback(() => {
    setStatusFilter("all");
  }, []);

  return {
    // Search
    searchQuery,
    setSearchQuery,
    // Filter modal
    filterModalVisible,
    openFilterModal,
    closeFilterModal,
    // Status filter
    statusFilter,
    setStatusFilter,
    clearStatusFilter,
    // Category filter
    selectedCategories,
    toggleCategory,
    // Combined
    hasActiveFilters,
    hasSearchOrFilters,
    clearFilters,
  };
}

// Helper function to get category label
export const getCategoryLabel = (category?: string): string => {
  if (!category) return "Other";
  const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
  return cat?.label || category;
};
