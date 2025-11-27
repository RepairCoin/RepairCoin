"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Star,
  MessageSquare,
  ThumbsUp,
  Calendar,
  User,
  Loader2,
  Filter,
  StarOff,
} from "lucide-react";
import { getShopReviews, addShopResponse, ServiceReviewWithDetails } from "@/services/api/services";

interface ReviewsTabProps {
  shopId: string;
}

export const ReviewsTab: React.FC<ReviewsTabProps> = ({ shopId }) => {
  const [reviews, setReviews] = useState<ServiceReviewWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [ratingFilter, shopId]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const response = await getShopReviews({
        page: 1,
        limit: 100,
        rating: ratingFilter,
      });

      if (response) {
        setReviews(response.data);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim()) {
      toast.error("Please enter a response");
      return;
    }

    setSubmittingResponse(true);
    try {
      await addShopResponse(reviewId, responseText);
      toast.success("Response added successfully!");
      setRespondingTo(null);
      setResponseText("");
      loadReviews();
    } catch (error) {
      console.error("Error adding response:", error);
      toast.error("Failed to add response");
    } finally {
      setSubmittingResponse(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? "fill-[#FFCC00] text-[#FFCC00]" : "text-gray-600"
            }`}
          />
        ))}
      </div>
    );
  };

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0";

  const ratingCounts = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
          <p className="text-white">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Customer Reviews</h1>
          <p className="text-gray-400">See what customers are saying about your services</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Average Rating */}
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#FFCC00]/20 rounded-xl">
              <Star className="w-8 h-8 text-[#FFCC00] fill-current" />
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Average Rating</p>
              <p className="text-3xl font-bold text-white">{averageRating}</p>
              <p className="text-xs text-gray-500">{reviews.length} reviews</p>
            </div>
          </div>
        </div>

        {/* Total Reviews */}
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <MessageSquare className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Reviews</p>
              <p className="text-3xl font-bold text-white">{reviews.length}</p>
              <p className="text-xs text-gray-500">All time</p>
            </div>
          </div>
        </div>

        {/* Response Rate */}
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <ThumbsUp className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Response Rate</p>
              <p className="text-3xl font-bold text-white">
                {reviews.length > 0
                  ? Math.round(
                      (reviews.filter((r) => r.shopResponse).length / reviews.length) * 100
                    )
                  : 0}
                %
              </p>
              <p className="text-xs text-gray-500">
                {reviews.filter((r) => r.shopResponse).length} responded
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Rating Distribution
        </h3>
        <div className="space-y-3">
          {ratingCounts.map(({ rating, count }) => {
            const percentage =
              reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
            return (
              <button
                key={rating}
                onClick={() => setRatingFilter(ratingFilter === rating ? undefined : rating)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  ratingFilter === rating
                    ? "bg-[#FFCC00]/10 border border-[#FFCC00]/30"
                    : "hover:bg-[#0D0D0D]"
                }`}
              >
                <div className="flex items-center gap-1 w-24">
                  <span className="text-sm font-semibold text-white">{rating}</span>
                  <Star className="w-3 h-3 fill-[#FFCC00] text-[#FFCC00]" />
                </div>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FFCC00] to-[#FFD700] transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-16 text-right">
                  {count} ({percentage}%)
                </span>
              </button>
            );
          })}
        </div>
        {ratingFilter && (
          <button
            onClick={() => setRatingFilter(undefined)}
            className="mt-4 text-sm text-[#FFCC00] hover:text-[#FFD700] underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">⭐</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {ratingFilter ? "No Reviews With This Rating" : "No Reviews Yet"}
          </h3>
          <p className="text-gray-400 mb-6">
            {ratingFilter
              ? "Try selecting a different rating"
              : "Your customers will be able to leave reviews after completing services"}
          </p>
          {ratingFilter && (
            <button
              onClick={() => setRatingFilter(undefined)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200"
            >
              Clear Filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.reviewId}
              className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6 hover:border-[#FFCC00]/30 transition-all duration-200"
            >
              {/* Review Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gray-800 rounded-full">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <code className="text-sm text-[#FFCC00] bg-[#FFCC00]/10 px-2 py-0.5 rounded">
                        {truncateAddress(review.customerAddress)}
                      </code>
                      <div className="flex items-center gap-2 mt-1">
                        {renderStars(review.rating)}
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {review.serviceName && (
                    <p className="text-sm text-gray-400 mb-2">
                      Service: <span className="text-white font-semibold">{review.serviceName}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Review Comment */}
              {review.comment && (
                <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-300 leading-relaxed">{review.comment}</p>
                </div>
              )}

              {/* Shop Response */}
              {review.shopResponse ? (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold text-blue-400">Your Response</span>
                    {review.shopResponseAt && (
                      <span className="text-xs text-gray-500">
                        · {formatDate(review.shopResponseAt.toString())}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-blue-200">{review.shopResponse}</p>
                </div>
              ) : respondingTo === review.reviewId ? (
                <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-4">
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Write a response to this review..."
                    className="w-full bg-transparent text-white text-sm border-none outline-none resize-none min-h-[80px] placeholder-gray-500"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleSubmitResponse(review.reviewId)}
                      disabled={submittingResponse || !responseText.trim()}
                      className="flex-1 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-4 py-2 rounded-lg hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingResponse ? "Submitting..." : "Submit Response"}
                    </button>
                    <button
                      onClick={() => {
                        setRespondingTo(null);
                        setResponseText("");
                      }}
                      className="px-4 py-2 bg-[#1A1A1A] border border-gray-800 text-white rounded-lg hover:border-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setRespondingTo(review.reviewId)}
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Respond to this review
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
