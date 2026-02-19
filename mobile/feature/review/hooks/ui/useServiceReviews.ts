import { useState, useCallback, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useQuery } from "@tanstack/react-query";
import { serviceApi } from "@/shared/services/service.services";
import { queryKeys } from "@/shared/config/queryClient";
import { ReviewData } from "@/shared/interfaces/review.interface";
import { useAuthStore } from "@/shared/store/auth.store";

export function useServiceReviews() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuthStore();
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

  // Check if user is shop owner of this service
  const serviceShopId = data?.data?.[0]?.serviceId ? null : null; // We need service data to check
  const isShopOwner = !!userProfile?.shopId;

  const allReviews = data?.data || [];
  const hasReviews = allReviews.length > 0;

  // Compute stats from reviews if not provided by API
  const stats = data?.stats || (hasReviews ? {
    totalReviews: allReviews.length,
    averageRating: allReviews.reduce((sum: number, r: ReviewData) => sum + r.rating, 0) / allReviews.length,
    ratingDistribution: {
      1: allReviews.filter((r: ReviewData) => r.rating === 1).length,
      2: allReviews.filter((r: ReviewData) => r.rating === 2).length,
      3: allReviews.filter((r: ReviewData) => r.rating === 3).length,
      4: allReviews.filter((r: ReviewData) => r.rating === 4).length,
      5: allReviews.filter((r: ReviewData) => r.rating === 5).length,
    }
  } : null);

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
    isShopOwner,

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
