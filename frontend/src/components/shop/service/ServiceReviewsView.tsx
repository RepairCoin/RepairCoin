"use client";

import React, { useState, useEffect } from 'react';
import { Star, Loader2, MessageCircle, ThumbsUp } from 'lucide-react';
import { servicesApi, ServiceReview, ShopService } from '@/services/api/services';
import { toast } from 'react-hot-toast';

interface ServiceReviewsViewProps {
  serviceId: string;
  service: ShopService;
}

export const ServiceReviewsView: React.FC<ServiceReviewsViewProps> = ({ serviceId, service }) => {
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [serviceId, selectedRating, currentPage]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const response = await servicesApi.getServiceReviews(serviceId, {
        page: currentPage,
        limit: 10,
        rating: selectedRating || undefined
      });

      if (response) {
        setReviews(response.data);
        setTotalPages(response.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim()) {
      toast.error('Please enter a response');
      return;
    }

    try {
      setSubmittingResponse(true);
      await servicesApi.addShopResponse(reviewId, responseText);
      toast.success('Response added successfully!');
      setRespondingTo(null);
      setResponseText('');
      loadReviews();
    } catch (error) {
      console.error('Error submitting response:', error);
      toast.error('Failed to add response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'fill-[#FFCC00] text-[#FFCC00]'
                : 'text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  const calculateAverageRating = () => {
    if (reviews.length === 0) return '0.0';
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  const getRatingCounts = () => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      counts[review.rating as keyof typeof counts]++;
    });
    return counts;
  };

  if (loading && currentPage === 1) {
    return (
      <div className="flex items-center justify-center py-12 bg-[#1A1A1A] border border-gray-800 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        <span className="ml-3 text-gray-400">Loading reviews...</span>
      </div>
    );
  }

  const ratingCounts = getRatingCounts();

  return (
    <div className="space-y-6">
      {/* Reviews Summary */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Reviews Summary</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Average Rating */}
          <div className="text-center">
            <div className="text-4xl font-bold text-[#FFCC00] mb-2">
              {calculateAverageRating()}
            </div>
            <div className="flex justify-center mb-2">
              {renderStars(Math.round(parseFloat(calculateAverageRating())))}
            </div>
            <p className="text-gray-400 text-sm">
              Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
            </p>
          </div>

          {/* Rating Distribution */}
          <div className="col-span-2 space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = ratingCounts[rating as keyof typeof ratingCounts];
              const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;

              return (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 w-8">{rating}★</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#FFCC00]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400 w-12 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter by Rating */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            setSelectedRating(null);
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedRating === null
              ? 'bg-[#FFCC00] text-black'
              : 'bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-gray-700'
          }`}
        >
          All Reviews
        </button>
        {[5, 4, 3, 2, 1].map((rating) => (
          <button
            key={rating}
            onClick={() => {
              setSelectedRating(rating);
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${
              selectedRating === rating
                ? 'bg-[#FFCC00] text-black'
                : 'bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-gray-700'
            }`}
          >
            {rating} <Star className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Reviews Yet</h3>
          <p className="text-gray-400">
            {selectedRating
              ? `No ${selectedRating}-star reviews for this service`
              : 'This service hasn\'t received any reviews yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.reviewId}
              className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6"
            >
              {/* Review Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-white">
                      {review.customerName || 'Anonymous Customer'}
                    </span>
                    {renderStars(review.rating)}
                  </div>
                  <p className="text-sm text-gray-400">
                    {new Date(review.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {/* Review Content */}
              {review.comment && (
                <p className="text-gray-300 mb-4 whitespace-pre-wrap">{review.comment}</p>
              )}

              {/* Review Footer */}
              <div className="flex items-center gap-4 text-sm text-gray-400 pt-4 border-t border-gray-800">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4" />
                  <span>{review.helpfulCount || 0}</span>
                </div>

                {!review.shopResponse && (
                  <button
                    onClick={() => setRespondingTo(review.reviewId)}
                    className="flex items-center gap-1 text-[#FFCC00] hover:text-[#FFD700] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Respond
                  </button>
                )}
              </div>

              {/* Shop Response */}
              {review.shopResponse && (
                <div className="mt-4 pl-4 border-l-2 border-[#FFCC00] bg-[#FFCC00]/5 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-[#FFCC00]">
                      Shop Response
                    </span>
                    {review.shopResponseAt && (
                      <span className="text-xs text-gray-500">
                        {new Date(review.shopResponseAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">
                    {review.shopResponse}
                  </p>
                </div>
              )}

              {/* Response Form */}
              {respondingTo === review.reviewId && (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Write your response..."
                    rows={4}
                    className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSubmitResponse(review.reviewId)}
                      disabled={submittingResponse || !responseText.trim()}
                      className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {submittingResponse ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Response'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setRespondingTo(null);
                        setResponseText('');
                      }}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-[#1A1A1A] text-white border border-gray-800 rounded-lg hover:bg-[#2A2A2A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-[#1A1A1A] text-white border border-gray-800 rounded-lg hover:bg-[#2A2A2A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
