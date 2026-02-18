import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceApi } from "@/shared/services/service.services";
import { ReviewData } from "@/shared/interfaces/review.interface";
import { Alert } from "react-native";

export function useShopReviews() {
  const queryClient = useQueryClient();
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shopReviews"],
    queryFn: () =>
      serviceApi.getShopReviews({
        limit: 100,
      }),
  });

  const responseMutation = useMutation({
    mutationFn: ({ reviewId, response }: { reviewId: string; response: string }) =>
      serviceApi.addShopResponse(reviewId, response),
    onSuccess: () => {
      Alert.alert("Success", "Response added successfully!");
      setRespondingTo(null);
      setResponseText("");
      refetch();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to add response");
    },
  });

  const allReviews = data?.data || [];
  const stats = data?.stats || null;
  const hasReviews = allReviews.length > 0;

  // Calculate stats
  const averageRating = useMemo(() => {
    if (!allReviews.length) return "0.0";
    const sum = allReviews.reduce((acc: number, r: ReviewData) => acc + r.rating, 0);
    return (sum / allReviews.length).toFixed(1);
  }, [allReviews]);

  const responseRate = useMemo(() => {
    if (!allReviews.length) return 0;
    const responded = allReviews.filter((r: ReviewData) => r.shopResponse).length;
    return Math.round((responded / allReviews.length) * 100);
  }, [allReviews]);

  const ratingCounts = useMemo(() => {
    return [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: allReviews.filter((r: ReviewData) => r.rating === rating).length,
      percentage: allReviews.length > 0
        ? Math.round((allReviews.filter((r: ReviewData) => r.rating === rating).length / allReviews.length) * 100)
        : 0,
    }));
  }, [allReviews]);

  // Filter reviews client-side and sort by recent
  const reviews = useMemo(() => {
    if (!allReviews.length) return allReviews;

    let filtered = allReviews;
    if (ratingFilter !== null) {
      filtered = allReviews.filter(
        (review: ReviewData) => review.rating === ratingFilter
      );
    }

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

  const handleFilterChange = (rating: number | null) => {
    setRatingFilter(ratingFilter === rating ? null : rating);
  };

  const handleSubmitResponse = (reviewId: string) => {
    if (!responseText.trim()) {
      Alert.alert("Error", "Please enter a response");
      return;
    }
    responseMutation.mutate({ reviewId, response: responseText });
  };

  const handleStartResponding = (reviewId: string) => {
    setRespondingTo(reviewId);
    setResponseText("");
  };

  const handleCancelResponding = () => {
    setRespondingTo(null);
    setResponseText("");
  };

  return {
    // Data
    reviews,
    stats,
    hasReviews,
    totalReviews: allReviews.length,
    averageRating,
    responseRate,
    ratingCounts,
    respondedCount: allReviews.filter((r: ReviewData) => r.shopResponse).length,

    // State
    ratingFilter,
    refreshing,
    isLoading,
    error,
    respondingTo,
    responseText,
    isSubmittingResponse: responseMutation.isPending,

    // Handlers
    handleFilterChange,
    onRefresh,
    refetch,
    setResponseText,
    handleSubmitResponse,
    handleStartResponding,
    handleCancelResponding,
  };
}
