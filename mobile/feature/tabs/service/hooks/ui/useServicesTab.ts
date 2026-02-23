import { useState, useMemo, useCallback } from "react";
import { router } from "expo-router";
import { useService } from "@/shared/hooks/service/useService";
import { useFavorite } from "@/shared/hooks/favorite/useFavorite";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { SERVICE_CATEGORIES } from "@/shared/constants/service-categories";
import { ServiceStatusFilter, ServiceSortOption, PriceRange } from "../../types";

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
  const [sortOption, setSortOption] = useState<ServiceSortOption>("default");
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: null, max: null });

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
    setSortOption("default");
    setPriceRange({ min: null, max: null });
  }, []);

  const hasActiveFilters =
    statusFilter !== "all" ||
    selectedCategories.length > 0 ||
    sortOption !== "default" ||
    priceRange.min !== null ||
    priceRange.max !== null;

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

    // Apply price range filter
    if (priceRange.min !== null) {
      services = services.filter(
        (service: ServiceData) => service.priceUsd >= priceRange.min!
      );
    }
    if (priceRange.max !== null) {
      services = services.filter(
        (service: ServiceData) => service.priceUsd <= priceRange.max!
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      services = services.filter((service: ServiceData) =>
        service.serviceName.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortOption !== "default") {
      services = [...services].sort((a: ServiceData, b: ServiceData) => {
        switch (sortOption) {
          case "price_low":
            return a.priceUsd - b.priceUsd;
          case "price_high":
            return b.priceUsd - a.priceUsd;
          case "duration_short":
            return (a.durationMinutes || 0) - (b.durationMinutes || 0);
          case "duration_long":
            return (b.durationMinutes || 0) - (a.durationMinutes || 0);
          case "newest":
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          default:
            return 0;
        }
      });
    }

    return services;
  }, [servicesData, statusFilter, selectedCategories, searchQuery, sortOption, priceRange]);

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

    // Sorting
    sortOption,
    setSortOption,

    // Price range
    priceRange,
    setPriceRange,

    // Actions
    handleServicePress,
    handleRefresh,

    // Helpers
    getCategoryLabel,
    categories: SERVICE_CATEGORIES,
  };
}
