import { useState, useCallback, useMemo } from "react";
import { ServiceData } from "@/interfaces/service.interface";
import { ServiceStatusFilter } from "../../types";
import { useServiceQueries } from "../queries/useServiceQueries";

export function useServicesTabUI() {
  // Query
  const { servicesTabQuery } = useServiceQueries();
  const { data: servicesData, isLoading, error, refetch } = servicesTabQuery;

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filter services based on all criteria
  const filteredServices = useMemo(() => {
    let services = servicesData || [];

    // Apply status filter
    if (statusFilter === "active") {
      services = services.filter((service: ServiceData) => service.active);
    } else if (statusFilter === "inactive") {
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

  return {
    // Data
    services: filteredServices,
    serviceCount: filteredServices.length,
    isLoading,
    error,
    refreshing,
    handleRefresh,
    refetch,
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
