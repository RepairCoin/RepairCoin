import { useState, useMemo, useCallback, useEffect } from "react";
import { router } from "expo-router";
import { useService } from "../useService";
import { useFavorite } from "../useFavorite";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { SERVICE_CATEGORIES } from "@/shared/constants/service-categories";
import { ServiceCategory } from "@/shared/constants/service-categories";
import { CustomerServiceStatusFilter, ServiceSortOption, PriceRange } from "../../tab-types";

export function useServicesTab() {
  const { useInfiniteServicesQuery } = useService();
  const { useGetFavorites } = useFavorite();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: null, max: null });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build filters for API query
  const apiFilters = useMemo(() => {
    const filters = {
      search: debouncedSearch || undefined,
      category: selectedCategories.length === 1 ? selectedCategories[0] as ServiceCategory : undefined,
      minPrice: priceRange.min ?? undefined,
      maxPrice: priceRange.max ?? undefined,
    };
    return filters;
  }, [debouncedSearch, selectedCategories, priceRange]);

  const {
    data: servicesPages,
    isLoading,
    isFetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteServicesQuery(apiFilters);

  // Flatten paginated data into single array
  const servicesData = useMemo(() => {
    if (!servicesPages?.pages) return [];
    return servicesPages.pages.flatMap(page => page.data);
  }, [servicesPages]);

  // Fetch all favorites once to avoid N API calls
  const { data: favoritesData } = useGetFavorites();

  // Create a Set of favorited service IDs for O(1) lookup
  const favoritedIds = useMemo(() => {
    if (!favoritesData) return new Set<string>();
    return new Set(favoritesData.map((s: ServiceData) => s.serviceId));
  }, [favoritesData]);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CustomerServiceStatusFilter>("all");
  const [sortOption, setSortOption] = useState<ServiceSortOption>("default");

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

    // Apply multi-category filter client-side (API only supports single category)
    if (selectedCategories.length > 1) {
      services = services.filter((service: ServiceData) =>
        selectedCategories.includes(service.category)
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
  }, [servicesData, statusFilter, selectedCategories, sortOption]);

  // Total matching results from the API (server-side filtered count across all pages),
  // not just the items currently loaded in memory.
  const totalResults = useMemo(() => {
    if (!servicesPages?.pages?.length) return 0;
    return servicesPages.pages[0]?.pagination?.totalItems ?? filteredServices.length;
  }, [servicesPages, filteredServices.length]);

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

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    // Data
    servicesData,
    filteredServices,
    totalResults,
    favoritedIds,
    isLoading,
    isFetching,
    error,

    // Pagination
    hasNextPage,
    isFetchingNextPage,
    handleLoadMore,

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
