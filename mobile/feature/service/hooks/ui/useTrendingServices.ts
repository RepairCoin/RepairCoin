import { useState, useCallback } from "react";
import { router } from "expo-router";
import { useService } from "@/shared/hooks/service/useService";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { ServiceData } from "@/interfaces/service.interface";
import { DEFAULT_TRENDING_LIMIT, DEFAULT_TRENDING_DAYS } from "../../constants";

export function useTrendingServices() {
  const { useGetTrendingServices } = useService();
  const {
    data: trendingServices,
    isLoading,
    refetch,
  } = useGetTrendingServices({
    limit: DEFAULT_TRENDING_LIMIT,
    days: DEFAULT_TRENDING_DAYS,
  });

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const handleServicePress = (item: ServiceData) => {
    router.push("/customer/service/" + item.serviceId as any);
  };

  return {
    trendingServices,
    isLoading,
    refreshing,
    onRefresh,
    getCategoryLabel,
    handleServicePress,
  };
}
