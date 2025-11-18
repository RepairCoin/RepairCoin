"use client";

import { AlertTriangle, X } from "lucide-react";

interface SuspendedActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: string; // e.g., "mint tokens", "redeem tokens", "send gifts"
  reason?: string;
}

export function SuspendedActionModal({
  isOpen,
  onClose,
  action,
  reason
}: SuspendedActionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="bg-red-100 rounded-full p-3">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          Action Not Available
        </h3>

        {/* Message */}
        <p className="text-gray-600 text-center mb-4">
          You cannot {action} because your account is currently suspended.
        </p>

        {reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Suspension Reason:</span> {reason}
            </p>
          </div>
        )}

        {/* Contact support message */}
        <p className="text-sm text-gray-500 text-center mb-6">
          Please contact support to request account unsuspension if you believe this is an error.
        </p>

        {/* Action button */}
        <button
          onClick={onClose}
          className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}
