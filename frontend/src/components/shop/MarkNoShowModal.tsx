"use client";

import React, { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { servicesApi, ServiceOrderWithDetails } from "@/services/api/services";

interface MarkNoShowModalProps {
  order: ServiceOrderWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MarkNoShowModal: React.FC<MarkNoShowModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !order) return null;

  const handleMarkNoShow = async () => {
    try {
      setIsSubmitting(true);

      // Call the mark no-show API
      await servicesApi.markOrderAsNoShow(order.orderId, notes);

      toast.success("Booking marked as no-show");

      // Reset form
      setNotes("");

      // Call success callback
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error marking as no-show:", error);
      toast.error(error.response?.data?.error || "Failed to mark as no-show");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setNotes("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div
          className="relative bg-[#1A1A1A] rounded-2xl max-w-lg w-full border border-gray-800 shadow-2xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-gray-800 px-6 py-5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Mark as No-Show</h2>
                <p className="text-sm text-gray-400">
                  Customer didn't arrive for appointment
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
                  <p className="text-sm text-gray-400">{order.customerName || 'Customer'}</p>
                  <p className="text-sm text-green-400 font-semibold mt-1">
                    ${order.totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-200">
                  <p className="font-semibold mb-1">Important</p>
                  <p>
                    Marking this booking as no-show will:
                  </p>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Notify the customer</li>
                    <li>Record this in their booking history</li>
                    <li>Help track customer reliability</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Notes Field */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                placeholder="Add any additional details about the no-show..."
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
              Cancel
            </button>
            <button
              onClick={handleMarkNoShow}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Marking...
                </>
              ) : (
                "Mark as No-Show"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
