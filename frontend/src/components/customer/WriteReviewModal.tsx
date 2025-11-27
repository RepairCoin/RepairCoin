"use client";

import React, { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { servicesApi, ServiceOrderWithDetails } from "@/services/api/services";
import { StarRating } from "./StarRating";

interface WriteReviewModalProps {
  /**
   * Order to review
   */
  order: ServiceOrderWithDetails;
  /**
   * Whether modal is open
   */
  isOpen: boolean;
  /**
   * Close modal callback
   */
  onClose: () => void;
  /**
   * Success callback (refresh reviews)
   */
  onSuccess?: () => void;
}

export const WriteReviewModal: React.FC<WriteReviewModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    if (!comment.trim()) {
      toast.error("Please write a review");
      return;
    }

    try {
      setIsSubmitting(true);

      await servicesApi.createReview({
        orderId: order.orderId,
        rating,
        comment: comment.trim(),
      });

      toast.success("Review submitted successfully!");
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast.error(error.response?.data?.error || "Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRating(0);
      setComment("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-100">Write a Review</h2>
              <p className="text-sm text-gray-400 mt-1">
                Share your experience with {order.serviceName}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Service Info */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start gap-4">
                {order.serviceImageUrl && (
                  <img
                    src={order.serviceImageUrl}
                    alt={order.serviceName}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-200">{order.serviceName}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {order.shopName || "Shop"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Completed: {new Date(order.completedAt || order.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Your Rating <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-4">
                <StarRating
                  value={rating}
                  interactive
                  onChange={setRating}
                  size="lg"
                />
                {rating > 0 && (
                  <span className="text-[#FFCC00] font-semibold">
                    {rating === 1 && "Poor"}
                    {rating === 2 && "Fair"}
                    {rating === 3 && "Good"}
                    {rating === 4 && "Very Good"}
                    {rating === 5 && "Excellent"}
                  </span>
                )}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label
                htmlFor="comment"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Your Review <span className="text-red-500">*</span>
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell others about your experience with this service..."
                rows={6}
                maxLength={1000}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none disabled:opacity-50"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">
                  Be specific and honest to help others make informed decisions
                </span>
                <span className="text-xs text-gray-500">
                  {comment.length}/1000
                </span>
              </div>
            </div>

            {/* Guidelines */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-400 mb-2">
                Review Guidelines
              </h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Focus on your experience with the service</li>
                <li>• Be honest and constructive</li>
                <li>• Avoid personal attacks or inappropriate language</li>
                <li>• Keep it relevant to the service provided</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || rating === 0 || !comment.trim()}
                className="px-6 py-2.5 bg-[#FFCC00] text-black font-semibold rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Review
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
