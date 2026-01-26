import { useState, useMemo, useCallback } from "react";
import { router } from "expo-router";
import { useService } from "@/shared/hooks/service/useService";
import { useFavorite } from "@/shared/hooks/favorite/useFavorite";
import { ServiceData } from "@/interfaces/service.interface";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { ServiceStatusFilter } from "../../types";

export function useServicesTab() {
  const { useGetAllServicesQuery } = useService();
  const { useGetFavorites } = useFavorite();

  const {
    data: servicesData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetAllServicesQuery();

  // Fetch all favorites once to avoid N API calls
  const { data: favoritesData } = useGetFavorites();

  // Create a Set of favorited service IDs for O(1) lookup
  const favoritedIds = useMemo(() => {
    if (!favoritesData) return new Set<string>();
    return new Set(favoritesData.map((s: ServiceData) => s.serviceId));
  }, [favoritesData]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setSelectedCategories([]);
  }, []);

  const hasActiveFilters = statusFilter !== "all" || selectedCategories.length > 0;

  const filteredServices = useMemo(() => {
    let services = servicesData || [];

    // Apply status filter
    if (statusFilter === "available") {
      services = services.filter((service: ServiceData) => service.active);
    } else if (statusFilter === "unavailable") {
      services = services.filter((service: ServiceData) => !service.active);
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
      services = services.filter((service: ServiceData) =>
        selectedCategories.includes(service.category)
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      services = services.filter((service: ServiceData) =>
        service.serviceName.toLowerCase().includes(query)
      );
    }

    return services;
  }, [servicesData, statusFilter, selectedCategories, searchQuery]);

  const handleServicePress = useCallback((item: ServiceData) => {
    router.push(`/customer/service/${item.serviceId}`);
  }, []);

  const getCategoryLabel = useCallback((category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  }, []);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const openFilterModal = useCallback(() => {
    setFilterModalVisible(true);
  }, []);

  const closeFilterModal = useCallback(() => {
    setFilterModalVisible(false);
  }, []);

  return {
    // Data
    servicesData,
    filteredServices,
    favoritedIds,
    isLoading,
    isFetching,
    error,

    // Search and filters
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    selectedCategories,
    toggleCategory,
    clearFilters,
    hasActiveFilters,
    filterModalVisible,
    openFilterModal,
    closeFilterModal,

    // Actions
    handleServicePress,
    handleRefresh,

    // Helpers
    getCategoryLabel,
    categories: SERVICE_CATEGORIES,
  };
}
