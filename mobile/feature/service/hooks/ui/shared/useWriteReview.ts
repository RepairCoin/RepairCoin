import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/shared/utilities/axios";
import { useAppToast } from "@/shared/hooks";
import { queryKeys } from "@/shared/config/queryClient";
import { SubmitReviewData, RatingLevel } from "../../types";
import { RATING_LABELS } from "../../constants";

export function useWriteReview() {
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  const serviceId = params.serviceId as string | undefined;
  const serviceName = params.serviceName as string | undefined;
  const shopName = params.shopName as string | undefined;

  const [rating, setRating] = useState<RatingLevel>(0);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const queryClient = useQueryClient();
  const { showSuccess, showError, showWarning } = useAppToast();

  const submitReviewMutation = useMutation({
    mutationFn: async (data: SubmitReviewData) => {
      const response = await apiClient.post("/services/reviews", data);
      return response.data;
    },
    onSuccess: () => {
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
      showSuccess("Thank you for your feedback!");
      router.back();
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error ||
        "Failed to submit review. Please try again.";
      showError(message);
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      showWarning("Please select a star rating.");
      return;
    }

    submitReviewMutation.mutate({
      orderId: orderId!,
      rating,
      comment: comment.trim(),
      images: images.length > 0 ? images : undefined,
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
    images,
    setImages,
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
