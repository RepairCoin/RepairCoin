"use client";

import React, { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import { cancelOrderByShop } from "@/services/api/services";

interface CancelBookingModalProps {
  bookingId: string;
  orderId: string;
  serviceName: string;
  customerName: string;
  onClose: () => void;
  onCancelled: () => void;
}

const CANCELLATION_REASONS = [
  { value: 'customer_request', label: 'Customer requested cancellation' },
  { value: 'schedule_conflict', label: 'Schedule conflict' },
  { value: 'service_unavailable', label: 'Service no longer available' },
  { value: 'capacity_issues', label: 'Capacity/resource issues' },
  { value: 'emergency', label: 'Emergency/unforeseen circumstances' },
  { value: 'other', label: 'Other' },
];

export const CancelBookingModal: React.FC<CancelBookingModalProps> = ({
  bookingId,
  orderId,
  serviceName,
  customerName,
  onClose,
  onCancelled,
}) => {
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason) {
      toast.error('Please select a cancellation reason');
      return;
    }

    setLoading(true);
    try {
      await cancelOrderByShop(orderId, reason, notes || undefined);
      toast.success('Booking cancelled successfully');
      onCancelled();
      onClose();
    } catch (error) {
      toast.error('Failed to cancel booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Cancel Booking</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Booking Info */}
        <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-4 mb-6">
          <p className="text-gray-400 text-sm">Booking ID: <span className="text-white">{bookingId}</span></p>
          <p className="text-gray-400 text-sm mt-1">Service: <span className="text-white">{serviceName}</span></p>
          <p className="text-gray-400 text-sm mt-1">Customer: <span className="text-white">{customerName}</span></p>
        </div>

        {/* Warning */}
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm">
            This action will cancel the booking and notify the customer. If the booking was paid, a refund may need to be processed separately.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Reason Select */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Cancellation Reason <span className="text-red-400">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-[#FFCC00] focus:outline-none"
              required
            >
              <option value="">Select a reason...</option>
              {CANCELLATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional details..."
              rows={3}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-[#FFCC00] focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-gray-300 hover:border-gray-500 transition-colors"
            >
              Keep Booking
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-red-600 rounded-lg text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Cancelling...' : 'Cancel Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
