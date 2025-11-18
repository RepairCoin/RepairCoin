"use client";

import { AlertTriangle } from "lucide-react";

interface SuspensionBannerProps {
  reason?: string;
  suspendedAt?: string;
}

export function SuspensionBanner({ reason, suspendedAt }: SuspensionBannerProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "recently";
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return "recently";
    }
  };

  return (
    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-900 mb-1">
            Account Suspended
          </h3>
          <p className="text-sm text-red-800 mb-2">
            Your account was suspended on {formatDate(suspendedAt)}.
          </p>
          {reason && (
            <p className="text-sm text-red-700 bg-red-100 rounded px-3 py-2 border border-red-200">
              <span className="font-medium">Reason:</span> {reason}
            </p>
          )}
          <p className="text-sm text-red-700 mt-3">
            You can view your account information but cannot earn or redeem tokens while suspended.
            Please contact support for assistance.
          </p>
        </div>
      </div>
    </div>
  );
}
