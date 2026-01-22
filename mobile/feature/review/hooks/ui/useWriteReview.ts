import { useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/utilities/axios";
import { queryKeys } from "@/config/queryClient";
import { ReviewParams, SubmitReviewData, RatingLevel } from "../../types";
import { RATING_LABELS } from "../../constants";

export function useWriteReview() {
  const { orderId, serviceId, serviceName, shopName } =
    useLocalSearchParams<ReviewParams>();

  const [rating, setRating] = useState<RatingLevel>(0);
  const [comment, setComment] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const submitReviewMutation = useMutation({
    mutationFn: async (data: SubmitReviewData) => {
      const response = await apiClient.post("/services/reviews", data);
      return response.data;
    },
    onSuccess: () => {
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
      Alert.alert("Review Submitted", "Thank you for your feedback!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error ||
        "Failed to submit review. Please try again.";
      Alert.alert("Error", message);
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert("Rating Required", "Please select a star rating.");
      return;
    }

    submitReviewMutation.mutate({
      orderId: orderId!,
      rating,
      comment: comment.trim(),
    });
  };

  const handleRatingSelect = (star: RatingLevel) => {
    setRating(star);
  };

  const getRatingText = () => {
    return RATING_LABELS[rating];
  };

  const handleGoBack = () => {
    goBack();
  };

  const isSubmitDisabled =
    rating === 0 || submitReviewMutation.isPending || isSubmitted;

  return {
    // Params
    orderId,
    serviceId,
    serviceName,
    shopName,

    // Form state
    rating,
    comment,
    setComment,
    isSubmitted,

    // Handlers
    handleRatingSelect,
    handleSubmit,
    handleGoBack,

    // Computed
    getRatingText,
    isSubmitDisabled,
    isPending: submitReviewMutation.isPending,
  };
}
