import { useState, useCallback } from "react";
import { router } from "expo-router";
import { useGetTrendingServicesQuery } from "./useFeatureTabQuery";
import { SERVICE_CATEGORIES } from "@/shared/constants/service-categories";
import { ServiceData } from "@/feature/services/services/service.interface";
import { DEFAULT_TRENDING_LIMIT, DEFAULT_TRENDING_DAYS } from "@/shared/constants/services";

export function useTrendingServices() {
  const {
    data: trendingServices,
    isLoading,
    refetch,
  } = useGetTrendingServicesQuery({
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
