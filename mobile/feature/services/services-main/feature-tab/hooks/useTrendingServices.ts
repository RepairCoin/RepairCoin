import { useState, useCallback, useMemo } from "react";
import { router } from "expo-router";
import { useGetTrendingServicesQuery, DEFAULT_AD_PLACEMENT } from "./useFeatureTabQuery";
import { useAdPlacements } from "./useAdPlacements";
import { SERVICE_CATEGORIES } from "@/shared/constants/service-categories";
import { ServiceData } from "@/feature/services/services/service.interface";
import { DEFAULT_TRENDING_LIMIT, DEFAULT_TRENDING_DAYS } from "@/shared/constants/services";
import { buildAdRows } from "../utils/buildAdRows";

export function useTrendingServices() {
  const {
    data: trendingServices,
    isLoading,
    refetch,
  } = useGetTrendingServicesQuery({
    limit: DEFAULT_TRENDING_LIMIT,
    days: DEFAULT_TRENDING_DAYS,
  });

  // Ads are additive only — this query never gates loading or the empty state, so a failure
  // here leaves the trending grid exactly as it would render without ads.
  const { ads, refetchAds, handleAdPress } = useAdPlacements(DEFAULT_AD_PLACEMENT);

  const [refreshing, setRefreshing] = useState(false);

  const rows = useMemo(
    () => buildAdRows(trendingServices, ads),
    [trendingServices, ads],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Rotate ads alongside the services; an ads failure must not abort the refresh.
    await Promise.all([refetch(), refetchAds().catch(() => undefined)]);
    setRefreshing(false);
  }, [refetch, refetchAds]);

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
    rows,
    isLoading,
    refreshing,
    onRefresh,
    getCategoryLabel,
    handleServicePress,
    handleAdPress,
  };
}
