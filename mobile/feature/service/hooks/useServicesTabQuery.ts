import { useMemo, useState, useCallback } from "react";
import { useService } from "@/hooks/service/useService";
import { useAuthStore } from "@/store/auth.store";
import { ServiceData } from "@/interfaces/service.interface";

export type ServiceStatusFilter = "all" | "active" | "inactive";

export function useServicesTabQuery(
  searchQuery: string,
  statusFilter: ServiceStatusFilter,
  selectedCategories: string[]
) {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;
  const { useShopServicesQuery } = useService();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: servicesData,
    isLoading,
    error,
    refetch,
  } = useShopServicesQuery({ shopId, page: 1, limit: 10 });

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

  return {
    services: filteredServices,
    serviceCount: filteredServices.length,
    isLoading,
    error,
    refreshing,
    handleRefresh,
    refetch,
  };
}
