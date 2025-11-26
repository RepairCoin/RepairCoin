"use client";

import React, { useState, useEffect } from "react";
import { ThumbsUp, MessageSquare, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";
import { servicesApi, ServiceReview } from "@/services/api/services";
import { StarRating } from "./StarRating";
import { useAuthStore } from "@/stores/authStore";

interface ReviewListProps {
  /**
   * Service ID to fetch reviews for
   */
  serviceId: string;
  /**
   * Maximum number of reviews to show initially
   */
  initialLimit?: number;
  /**
   * Show filter by rating
   */
  showFilter?: boolean;
  /**
   * Custom className
   */
  className?: string;
}

export const ReviewList: React.FC<ReviewListProps> = ({
  serviceId,
  initialLimit = 5,
  showFilter = true,
  className = "",
}) => {
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filterRating, setFilterRating] = useState<number | undefined>(undefined);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const { user } = useAuthStore();

  useEffect(() => {
    fetchReviews();
  }, [serviceId, filterRating, page]);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const response = await servicesApi.getServiceReviews(serviceId, {
        page,
        limit: initialLimit,
        rating: filterRating,
      });

      if (response) {
        if (page === 1) {
          setReviews(response.data || []);
        } else {
          setReviews((prev) => [...prev, ...(response.data || [])]);
        }
        setHasMore(response.pagination?.hasMore || false);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
      toast.error("Failed to load reviews");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkHelpful = async (reviewId: string) => {
    try {
      await servicesApi.markReviewHelpful(reviewId);
      // Update local state
      setReviews((prev) =>
        prev.map((review) =>
          review.reviewId === reviewId
            ? { ...review, helpfulCount: review.helpfulCount + 1 }
            : review
        )
      );
      toast.success("Thanks for your feedback!");
    } catch (error) {
      console.error("Error marking review helpful:", error);
    }
  };

  const toggleExpanded = (reviewId: string) => {
    setExpandedReviews((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  const handleFilterChange = (rating: number | undefined) => {
    setFilterRating(rating);
    setPage(1);
    setReviews([]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading && page === 1) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00]"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Filter */}
      {showFilter && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-400">Filter by rating:</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleFilterChange(undefined)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                filterRating === undefined
                  ? "bg-[#FFCC00] text-black font-semibold"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              All
            </button>
            {[5, 4, 3, 2, 1].map((rating) => (
              <button
                key={rating}
                onClick={() => handleFilterChange(rating)}
                className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 transition-colors ${
                  filterRating === rating
                    ? "bg-[#FFCC00] text-black font-semibold"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {rating} ⭐
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviews.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">
            {filterRating
              ? `No ${filterRating}-star reviews yet`
              : "No reviews yet. Be the first to review!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const isExpanded = expandedReviews.has(review.reviewId);
            const commentTruncated =
              review.comment && review.comment.length > 200
                ? review.comment.slice(0, 200) + "..."
                : review.comment;

            return (
              <div
                key={review.reviewId}
                className="bg-gray-800 rounded-lg p-5 border border-gray-700"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-gray-200">
                        {review.customerName || "Anonymous"}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    <StarRating value={review.rating} size="sm" />
                  </div>
                </div>

                {/* Comment */}
                {review.comment && (
                  <div className="mb-3">
                    <p className="text-gray-300 leading-relaxed">
                      {isExpanded ? review.comment : commentTruncated}
                    </p>
                    {review.comment.length > 200 && (
                      <button
                        onClick={() => toggleExpanded(review.reviewId)}
                        className="text-[#FFCC00] text-sm mt-2 hover:underline flex items-center gap-1"
                      >
                        {isExpanded ? "Show less" : "Read more"}
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    )}
                  </div>
                )}

                {/* Images */}
                {review.images && review.images.length > 0 && (
                  <div className="flex gap-2 mb-3 overflow-x-auto">
                    {review.images.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`Review image ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}

                {/* Shop Response */}
                {review.shopResponse && (
                  <div className="mt-3 pl-4 border-l-2 border-[#FFCC00] bg-gray-900/50 p-3 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-[#FFCC00]">
                        Response from {review.shopName || "Shop"}
                      </span>
                      {review.shopResponseAt && (
                        <span className="text-xs text-gray-500">
                          {formatDate(review.shopResponseAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">{review.shopResponse}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-700">
                  <button
                    onClick={() => handleMarkHelpful(review.reviewId)}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#FFCC00] transition-colors"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>Helpful ({review.helpfulCount})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {hasMore && !isLoading && (
        <div className="text-center pt-4">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Load More Reviews
          </button>
        </div>
      )}

      {/* Loading More */}
      {isLoading && page > 1 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00]"></div>
        </div>
      )}
    </div>
  );
};
