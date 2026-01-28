"use client";

import React from 'react';
import Image from 'next/image';
import {
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  Store,
  ExternalLink,
  Edit2,
  XCircle,
  Coins,
  RefreshCw
} from 'lucide-react';
import { CalendarBooking } from '@/services/api/appointments';
import { CountdownBadge } from './CountdownBadge';
import {
  formatTime12Hour,
  formatAppointmentDate,
  getDirectionsUrl
} from '@/utils/appointmentUtils';

interface AppointmentCardProps {
  appointment: CalendarBooking;
  onReschedule: () => void;
  onCancel: () => void;
  hasPendingReschedule: boolean;
  showActions?: boolean;
  canCancel?: boolean;
  canReschedule?: boolean;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onReschedule,
  onCancel,
  hasPendingReschedule,
  showActions = true,
  canCancel = true,
  canReschedule = true
}) => {
  const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
    confirmed: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Confirmed' },
    paid: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Paid' },
    'in-progress': { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'In Progress' },
    completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
    cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelled' }
  };

  const status = appointment.status.toLowerCase();
  const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const isUpcoming = !['completed', 'cancelled'].includes(status);

  // Check if appointment date is in the future
  const appointmentDate = new Date(appointment.bookingDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isFuture = appointmentDate >= today;

  const shopAddress = appointment.shopAddress || 'Address not available';
  const shopName = appointment.shopName || appointment.shopId;

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all duration-200">
      {/* Main Content */}
      <div className="p-4 sm:p-5">
        {/* Header: Service Info + Countdown Badge */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          {/* Service Info with Image */}
          <div className="flex gap-3 sm:gap-4 min-w-0 sm:max-w-[70%] overflow-hidden">
            {/* Service Image - 1:1 ratio */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 relative aspect-square">
              {appointment.serviceImage ? (
                <Image
                  src={appointment.serviceImage}
                  alt={appointment.serviceName}
                  fill
                  sizes="(max-width: 640px) 64px, 80px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                  <Store className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
                </div>
              )}
            </div>

            {/* Service & Shop Details */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <h3 className="text-base sm:text-lg font-bold text-white mb-1 truncate">
                {appointment.serviceName}
              </h3>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 mb-1">
                <Store className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <span className="truncate">{shopName}</span>
              </div>
              <div className="flex items-start gap-2 text-xs sm:text-sm text-gray-400">
                <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2 break-words">{shopAddress}</span>
              </div>
            </div>
          </div>

          {/* Countdown Badge - Only show for upcoming future appointments */}
          {isUpcoming && isFuture && (
            <div className="flex-shrink-0">
              <CountdownBadge
                bookingDate={appointment.bookingDate}
                bookingTime={appointment.bookingTimeSlot}
              />
            </div>
          )}
        </div>

        {/* Pending Reschedule Banner */}
        {hasPendingReschedule && (
          <div className="mb-4 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-orange-400 font-medium">
                Reschedule request pending approval
              </span>
            </div>
          </div>
        )}

        {/* Details Grid - Individual cards per column */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          {/* Appointment Date */}
          <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-xs text-gray-500 mb-1.5">Appointment Date</div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
              <span className="text-xs sm:text-sm font-semibold text-white">
                {formatAppointmentDate(appointment.bookingDate)}
              </span>
            </div>
          </div>

          {/* Time */}
          <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-xs text-gray-500 mb-1.5">Time</div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
              <span className="text-xs sm:text-sm font-semibold text-white">
                {appointment.bookingTimeSlot
                  ? formatTime12Hour(appointment.bookingTimeSlot)
                  : 'TBD'}
              </span>
            </div>
          </div>

          {/* Cost */}
          <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-xs text-gray-500 mb-1.5">Cost</div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
              <span className="text-xs sm:text-sm font-semibold text-white">
                ${appointment.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* RCN Gains */}
          <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-xs text-gray-500 mb-1.5">RCN Gains</div>
            <div className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FFCC00]" />
              <span className="text-xs sm:text-sm font-semibold text-[#FFCC00]">
                +{appointment.rcnEarned ?? 0} RCN
              </span>
            </div>
          </div>
        </div>

        {/* Get Directions Link */}
        {shopAddress && shopAddress !== 'Address not available' && (
          <a
            href={getDirectionsUrl(shopAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors mb-4 group"
          >
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Get Shop Directions</span>
            <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        )}

        {/* Action Buttons */}
        {showActions && isUpcoming && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 border-t border-gray-800">
            {canReschedule && (
              <button
                onClick={onReschedule}
                className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors ${
                  hasPendingReschedule
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20'
                    : 'bg-[#0D0D0D] text-white border border-gray-700 hover:bg-gray-800'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {hasPendingReschedule ? 'View Request' : 'Reschedule'}
              </button>
            )}

            {canCancel && (
              <button
                onClick={onCancel}
                className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-red-600 text-white rounded-lg font-semibold text-xs sm:text-sm hover:bg-red-700 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Cancel Appointment</span>
                <span className="sm:hidden">Cancel</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
