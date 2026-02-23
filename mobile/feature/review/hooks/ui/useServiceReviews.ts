import { useState, useCallback, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useQuery } from "@tanstack/react-query";
import { serviceApi } from "@/shared/services/service.services";
import { queryKeys } from "@/shared/config/queryClient";
import { ReviewData } from "@/shared/interfaces/review.interface";

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
    queryKey: queryKeys.serviceReviews(id!),
    queryFn: () =>
      serviceApi.getServiceReviews(id!, {
        limit: 50,
      }),
    enabled: !!id,
  });

  const allReviews = data?.data || [];
  const stats = data?.stats || null;
  const hasReviews = allReviews.length > 0;

  // Filter reviews client-side and sort by recent
  const reviews = useMemo(() => {
    if (!allReviews.length) return allReviews;

    // Apply rating filter
    let filtered = allReviews;
    if (ratingFilter !== null) {
      filtered = allReviews.filter(
        (review: ReviewData) => review.rating === ratingFilter
      );
    }

    // Sort by most recent
    return [...filtered].sort(
      (a: ReviewData, b: ReviewData) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [allReviews, ratingFilter]);

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
    hasReviews,

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
