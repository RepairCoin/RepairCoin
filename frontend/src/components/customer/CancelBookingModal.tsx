"use client";

import React, { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { servicesApi, ServiceOrderWithDetails } from "@/services/api/services";

interface CancelBookingModalProps {
  order: ServiceOrderWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CANCELLATION_REASONS = [
  { value: "schedule_conflict", label: "Schedule conflict" },
  { value: "found_alternative", label: "Found an alternative service" },
  { value: "too_expensive", label: "Too expensive" },
  { value: "changed_mind", label: "Changed my mind" },
  { value: "emergency", label: "Personal emergency" },
  { value: "other", label: "Other reason" },
];

export const CancelBookingModal: React.FC<CancelBookingModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !order) return null;

  const handleCancel = async () => {
    if (!selectedReason) {
      toast.error("Please select a cancellation reason");
      return;
    }

    try {
      setIsSubmitting(true);

      // Call the cancel order API
      await servicesApi.cancelOrder(order.orderId);

      toast.success("Booking cancelled successfully");

      // Reset form
      setSelectedReason("");
      setAdditionalNotes("");

      // Call success callback
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      toast.error(error.response?.data?.error || "Failed to cancel booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason("");
      setAdditionalNotes("");
      onClose();
    }
  };

  return (
    <>
      {/* Modal Container with Backdrop */}
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/70 backdrop-blur-sm" onClick={handleClose}>
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="bg-[#1A1A1A] rounded-2xl max-w-lg w-full border border-gray-800 shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-800 px-6 py-5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Cancel Booking</h2>
                <p className="text-sm text-gray-400">
                  Are you sure you want to cancel this booking?
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Booking Info */}
            <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4">
              <div className="flex items-start gap-4">
                {order.serviceImageUrl ? (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                    <img
                      src={order.serviceImageUrl}
                      alt={order.serviceName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">📦</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white mb-1">{order.serviceName}</h3>
                  <p className="text-sm text-gray-400">{order.shopName}</p>
                  <p className="text-sm text-green-400 font-semibold mt-1">
                    ${order.totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-200">
                  <p className="font-semibold mb-1">Warning</p>
                  <p>
                    This action cannot be undone. Your booking will be cancelled immediately,
                    and you may need to rebook if you change your mind.
                  </p>
                  {order.rcnRedeemed && order.rcnRedeemed > 0 && (
                    <p className="mt-2 text-red-300">
                      • Any RCN redeemed ({order.rcnRedeemed.toFixed(2)} RCN) will be refunded to your account
                    </p>
                  )}
                  {order.finalAmountUsd && order.finalAmountUsd > 0 && (
                    <p className="text-red-300">
                      • Payment refund (${order.finalAmountUsd.toFixed(2)}) may take 5-10 business days
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Cancellation Reason */}
            <div>
              <label className="block text-sm font-semibold text-white mb-3">
                Reason for cancellation <span className="text-red-400">*</span>
              </label>
              <div className="space-y-2">
                {CANCELLATION_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedReason === reason.value
                        ? "bg-[#FFCC00]/10 border-[#FFCC00] text-white"
                        : "bg-[#0D0D0D] border-gray-800 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancellation_reason"
                      value={reason.value}
                      checked={selectedReason === reason.value}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      disabled={isSubmitting}
                      className="w-4 h-4 text-[#FFCC00] focus:ring-[#FFCC00] focus:ring-offset-gray-900"
                    />
                    <span className="text-sm font-medium">{reason.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Notes (Optional) */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Additional notes (optional)
              </label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                disabled={isSubmitting}
                placeholder="Tell us more about why you're cancelling..."
                rows={3}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent resize-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-800 px-6 py-4 flex gap-3 flex-shrink-0">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Keep Booking
            </button>
            <button
              onClick={handleCancel}
              disabled={isSubmitting || !selectedReason}
              className="flex-1 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Booking"
              )}
            </button>
          </div>
          </div>
        </div>
      </div>
    </>
  );
};
