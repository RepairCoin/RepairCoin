import { useState, useCallback, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useInfiniteQuery } from "@tanstack/react-query";
import { serviceApi } from "@/feature/services/services/service.services";
import { queryKeys } from "@/shared/config/queryClient";
import { ReviewData } from "@/feature/services/services/service.interface";
import { useAuthStore } from "@/feature/auth/store/auth.store";

const PAGE_SIZE = 20;

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
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.serviceReviews(id!),
    queryFn: ({ pageParam }) =>
      serviceApi.getServiceReviews(id!, {
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    enabled: !!id,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore
        ? lastPage.pagination.page + 1
        : undefined,
    staleTime: 0,
    refetchOnMount: true,
  });

  const isShopOwner = !!userProfile?.shopId;
  const currentUserAddress: string | undefined = userProfile?.address;

  const allReviews = useMemo(
    () => data?.pages.flatMap((p) => p.data || []) ?? [],
    [data]
  );
  const hasReviews = allReviews.length > 0;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Compute stats from reviews if not provided by API
  const stats = data?.pages?.[0]?.stats || (hasReviews ? {
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
    currentUserAddress,

    // State
    ratingFilter,
    refreshing,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,

    // Handlers
    handleFilterChange,
    handleGoBack,
    onRefresh,
    refetch,
    loadMore,
  };
}
