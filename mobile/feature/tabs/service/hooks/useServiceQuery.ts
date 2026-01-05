import { useState, useMemo, useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useService } from "@/hooks/service/useService";
import { ServiceData } from "@/interfaces/service.interface";

export function useServiceQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  const { useShopServicesQuery } = useService();

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: servicesData,
    isLoading,
    error,
    refetch,
  } = useShopServicesQuery({
    shopId,
    page: 1,
    limit: 100,
  });

  // Filter services by search query
  const services = useMemo((): ServiceData[] => {
    const allServices = servicesData?.services || [];

    if (!searchQuery.trim()) {
      return allServices;
    }

    const query = searchQuery.toLowerCase();
    return allServices.filter(
      (service) =>
        service.serviceName?.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query) ||
        service.category?.toLowerCase().includes(query)
    );
  }, [servicesData, searchQuery]);

  // Service counts
  const serviceCount = services.length;
  const totalCount = servicesData?.services?.length || 0;
  const activeCount = services.filter((s) => s.active).length;
  const inactiveCount = services.filter((s) => !s.active).length;

  // Check if search is active
  const hasSearchQuery = searchQuery.trim().length > 0;

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  return {
    // Data
    services,
    serviceCount,
    totalCount,
    activeCount,
    inactiveCount,
    // Search
    searchQuery,
    setSearchQuery,
    hasSearchQuery,
    clearSearch,
    // Query state
    isLoading,
    error,
    refreshing,
    handleRefresh,
  };
}
