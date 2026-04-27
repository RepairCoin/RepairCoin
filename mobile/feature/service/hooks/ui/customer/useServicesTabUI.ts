import { useState, useCallback, useMemo, useEffect } from "react";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { ServiceStatusFilter } from "../../types";
import { useInfiniteShopServicesQuery } from "../queries/useServiceQueries";

export function useServicesTabUI() {
  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build filters for API query (backend handles search and single category)
  const apiFilters = useMemo(() => ({
    search: debouncedSearch || undefined,
    category: selectedCategories.length === 1 ? selectedCategories[0] : undefined,
  }), [debouncedSearch, selectedCategories]);

  // Query with infinite loading and backend filters
  const {
    data: servicesPages,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteShopServicesQuery(apiFilters);

  // Flatten paginated data into single array
  const servicesData = useMemo(() => {
    if (!servicesPages?.pages) return [];
    return servicesPages.pages.flatMap(page => page.data);
  }, [servicesPages]);

  // Client-side filtering only for status (active/inactive) and multi-category
  // Search and single category are handled by the backend
  const filteredServices = useMemo(() => {
    let services = servicesData || [];

    // Apply status filter (client-side since backend always returns all for shop owner)
    if (statusFilter === "active") {
      services = services.filter((service: ServiceData) => service.active);
    } else if (statusFilter === "inactive") {
      services = services.filter((service: ServiceData) => !service.active);
    }

    // Apply multi-category filter (backend only handles single category)
    if (selectedCategories.length > 1) {
      services = services.filter((service: ServiceData) =>
        selectedCategories.includes(service.category)
      );
    }

    return services;
  }, [servicesData, statusFilter, selectedCategories]);

  // Total matching results from the API (server-side filtered count across all pages),
  // not just the items currently loaded in memory.
  const totalResults = useMemo(() => {
    if (!servicesPages?.pages?.length) return 0;
    return servicesPages.pages[0]?.pagination?.totalItems ?? filteredServices.length;
  }, [servicesPages, filteredServices.length]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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

  // Modal handlers
  const openFilterModal = useCallback(() => setFilterModalVisible(true), []);
  const closeFilterModal = useCallback(() => setFilterModalVisible(false), []);
  const clearStatusFilter = useCallback(() => setStatusFilter("all"), []);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    // Data
    services: filteredServices,
    serviceCount: filteredServices.length,
    totalResults,
    isLoading,
    error,
    refreshing,
    handleRefresh,
    refetch,
    // Pagination
    hasNextPage,
    isFetchingNextPage,
    handleLoadMore,
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
