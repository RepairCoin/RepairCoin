import { useState, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useQuery } from "@tanstack/react-query";
import { serviceApi } from "@/shared/services/service.services";
import { queryKeys } from "@/shared/config/queryClient";

export function useServiceReviews() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKeys.serviceReviews(id!), ratingFilter],
    queryFn: () =>
      serviceApi.getServiceReviews(id!, {
        rating: ratingFilter || undefined,
        limit: 50,
      }),
    enabled: !!id,
  });

  const reviews = data?.data || [];
  const stats = data?.stats || null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleGoBack = () => {
    goBack();
  };

  const handleFilterChange = (rating: number | null) => {
    setRatingFilter(rating);
  };

  return {
    // Data
    reviews,
    stats,

    // State
    ratingFilter,
    refreshing,
    isLoading,
    error,

    // Handlers
    handleFilterChange,
    handleGoBack,
    onRefresh,
    refetch,
  };
}
