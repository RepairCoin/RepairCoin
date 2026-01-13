"use client";

import React, { ReactNode } from "react";
import {
  ShoppingBag,
  Clock,
  Calendar,
  MapPin,
  Store,
  DollarSign,
} from "lucide-react";

interface BookingCardProps {
  // Service Info
  serviceImageUrl?: string;
  serviceName: string;
  shopName: string;
  shopCity?: string;

  // Status
  statusBadge: ReactNode;

  // Booking Details
  dateBooked?: string;
  serviceDate?: string;
  serviceTime?: string;
  cost: number;

  // Progress Section (optional)
  progressSection?: ReactNode;

  // Next Action Section (optional)
  nextActionSection?: ReactNode;

  // Action Buttons
  actionButtons: ReactNode;

  // RCN Badge (optional)
  rcnBadge?: ReactNode;

  // Footer
  bookingId: string;

  // Additional custom sections
  additionalSections?: ReactNode;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  serviceImageUrl,
  serviceName,
  shopName,
  shopCity,
  statusBadge,
  dateBooked,
  serviceDate,
  serviceTime,
  cost,
  progressSection,
  nextActionSection,
  actionButtons,
  rcnBadge,
  bookingId,
  additionalSections,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl overflow-hidden hover:border-[#FFCC00]/30 transition-all duration-200">
      <div className="p-6">
        {/* Top Section: Image + Details */}
        <div className="flex gap-4 mb-4">
          {/* Service Image */}
          <div className="w-32 h-32 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
            {serviceImageUrl ? (
              <img
                src={serviceImageUrl}
                alt={serviceName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <ShoppingBag className="w-10 h-10 text-gray-600" />
              </div>
            )}
          </div>

          {/* Order Info */}
          <div className="flex-1 min-w-0">
            {/* Title & Status Badge */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white mb-2">
                  {serviceName}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <Store className="w-4 h-4" />
                  <span className="font-medium">{shopName}</span>
                </div>
                {shopCity && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span>{shopCity}</span>
                  </div>
                )}
              </div>
              {statusBadge}
            </div>
          </div>
        </div>

        {/* Booking Details Grid - Full Width */}
        {/* Service Date/Time shown first (most important), then Cost */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {serviceDate && (
            <div className="bg-[#0D0D0D] rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Service Date</div>
              <div className="flex items-center gap-1.5 text-white font-semibold">
                <Calendar className="w-4 h-4" />
                {formatDate(serviceDate)}
              </div>
            </div>
          )}
          {serviceTime && (
            <div className="bg-[#0D0D0D] rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Service Time</div>
              <div className="flex items-center gap-1.5 text-white font-semibold">
                <Clock className="w-4 h-4" />
                {serviceTime}
              </div>
            </div>
          )}
          <div className="bg-[#0D0D0D] rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Cost</div>
            <div className="flex items-center gap-1.5 text-green-400 font-bold text-lg">
              <DollarSign className="w-4 h-4" />
              {cost.toFixed(2)}
            </div>
          </div>
          {dateBooked && !serviceDate && (
            <div className="bg-[#0D0D0D] rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Date Booked</div>
              <div className="flex items-center gap-1.5 text-white font-semibold">
                <Calendar className="w-4 h-4" />
                {formatDate(dateBooked)}
              </div>
            </div>
          )}
        </div>

        {/* Additional Sections - Full Width */}
        {additionalSections}

        {/* Progress Bar Section - Full Width */}
        {progressSection}

        {/* Next Action Section - Full Width */}
        {nextActionSection}

        {/* Action Buttons - Full Width */}
        {actionButtons}

        {/* RCN Earned Badge - Full Width */}
        {rcnBadge}
      </div>

      {/* Booking ID Footer */}
      <div className="bg-[#0D0D0D] px-5 py-3 border-t border-gray-800">
        <div className="text-xs text-gray-500">
          Booking ID: <span className="font-mono text-gray-400">{bookingId}</span>
        </div>
      </div>
    </div>
  );
};
