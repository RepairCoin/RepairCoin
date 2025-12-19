"use client";

import React, { useState } from "react";
import { X, DollarSign, Clock, Tag, Star, MessageSquare, Users } from "lucide-react";
import { ShopService, SERVICE_CATEGORIES } from "@/services/api/services";
import { servicesApi, ServiceReview } from "@/services/api/services";
import { toast } from "react-hot-toast";
import { ServiceGroupSettings } from "@/components/shop/ServiceGroupSettings";

interface ShopServiceDetailsModalProps {
  service: ShopService;
  onClose: () => void;
}

export const ShopServiceDetailsModal: React.FC<ShopServiceDetailsModalProps> = ({
  service,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"details" | "reviews" | "groups">("details");
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const loadReviews = async () => {
    if (reviewsLoaded) return;

    setReviewsLoading(true);
    try {
      const response = await servicesApi.getServiceReviews(service.serviceId, {
        page: 1,
        limit: 100,
      });

      if (response) {
        setReviews(response.data);
        setReviewsLoaded(true);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
      toast.error("Failed to load reviews");
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleTabChange = (tab: "details" | "reviews" | "groups") => {
    setActiveTab(tab);
    if (tab === "reviews" && !reviewsLoaded) {
      loadReviews();
    }
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim()) {
      toast.error("Please enter a response");
      return;
    }

    setSubmittingResponse(true);
    try {
      await servicesApi.addShopResponse(reviewId, responseText);
      toast.success("Response added successfully!");
      setRespondingTo(null);
      setResponseText("");
      // Reload reviews
      setReviewsLoaded(false);
      loadReviews();
    } catch (error) {
      console.error("Error adding response:", error);
      toast.error("Failed to add response");
    } finally {
      setSubmittingResponse(false);
    }
  };

  const formatDate = (dateString: string | Date) => {
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

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1A1A1A] z-10 border-b border-gray-800">
          <div className="flex items-center justify-between p-6">
            <h2 className="text-2xl font-bold text-white">Service Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-gray-800">
            <button
              onClick={() => handleTabChange("details")}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === "details"
                  ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Details
            </button>
            <button
              onClick={() => handleTabChange("reviews")}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === "reviews"
                  ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Reviews {reviews.length > 0 ? `(${reviews.length})` : ""}
            </button>
            <button
              onClick={() => handleTabChange("groups")}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === "groups"
                  ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <Users className="w-4 h-4" />
              Group Rewards
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Details Tab */}
          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Service Image */}
              {service.imageUrl && (
                <div className="w-full h-64 rounded-xl overflow-hidden bg-gray-800">
                  <img
                    src={service.imageUrl}
                    alt={service.serviceName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Service Info */}
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
                <h3 className="text-2xl font-bold text-white mb-4">{service.serviceName}</h3>

                {service.category && (
                  <div className="mb-4">
                    <span className="inline-block text-sm bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] px-3 py-1.5 rounded-full">
                      {getCategoryLabel(service.category)}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-xs text-gray-400">Price</p>
                      <p className="text-xl font-bold text-green-500">
                        ${service.priceUsd.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {service.durationMinutes && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-xs text-gray-400">Duration</p>
                        <p className="text-lg font-semibold text-white">
                          {service.durationMinutes} min
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {service.description && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-white mb-2">Description</h4>
                    <p className="text-sm text-gray-400 leading-relaxed">{service.description}</p>
                  </div>
                )}

                {/* Tags */}
                {service.tags && service.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {service.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] px-3 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="mt-4 pt-4 border-t border-gray-800">
                  {service.active ? (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                      Active
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === "reviews" && (
            <div>
              {reviewsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto mb-4"></div>
                    <p className="text-white">Loading reviews...</p>
                  </div>
                </div>
              ) : reviews.length === 0 ? (
                <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-12 text-center">
                  <div className="text-6xl mb-4">⭐</div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Reviews Yet</h3>
                  <p className="text-gray-400">
                    This service hasn't received any reviews from customers yet
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-white mb-2">{averageRating}</div>
                        {renderStars(parseFloat(averageRating))}
                        <p className="text-xs text-gray-500 mt-2">{reviews.length} reviews</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-400">
                          {reviews.filter((r) => r.shopResponse).length} of {reviews.length} reviews
                          have been responded to
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reviews List */}
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div
                        key={review.reviewId}
                        className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-5"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {renderStars(review.rating)}
                              <span className="text-xs text-gray-500">
                                {formatDate(review.createdAt)}
                              </span>
                            </div>
                            <code className="text-sm text-[#FFCC00] bg-[#FFCC00]/10 px-2 py-0.5 rounded">
                              {truncateAddress(review.customerAddress)}
                            </code>
                          </div>
                        </div>

                        {review.comment && (
                          <p className="text-sm text-gray-300 mb-4">{review.comment}</p>
                        )}

                        {/* Shop Response */}
                        {review.shopResponse ? (
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="w-4 h-4 text-blue-400" />
                              <span className="text-sm font-semibold text-blue-400">
                                Your Response
                              </span>
                              {review.shopResponseAt && (
                                <span className="text-xs text-gray-500">
                                  · {formatDate(review.shopResponseAt)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-blue-200">{review.shopResponse}</p>
                          </div>
                        ) : respondingTo === review.reviewId ? (
                          <div className="bg-[#1A1A1A] border border-gray-700 rounded-lg p-4">
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
                                className="px-4 py-2 bg-[#0D0D0D] border border-gray-800 text-white rounded-lg hover:border-gray-700 transition-colors"
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
                </div>
              )}
            </div>
          )}

          {/* Groups Tab */}
          {activeTab === "groups" && (
            <div>
              <ServiceGroupSettings serviceId={service.serviceId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
