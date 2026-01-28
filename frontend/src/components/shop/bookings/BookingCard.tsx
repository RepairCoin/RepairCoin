"use client";

import React from "react";
import { Clock, CheckCircle, Calendar, Package, Info } from "lucide-react";
import { MockBooking, getStatusLabel, getStatusColor, formatDate, formatTime12Hour, truncateAddress } from "./mockData";

interface BookingCardProps {
  booking: MockBooking;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReschedule: () => void;
  onSchedule: () => void;
  onComplete: () => void;
  onCancel: () => void;
  isBlocked?: boolean;
  blockReason?: string;
}

// Progress steps for the booking flow
const progressSteps = ['requested', 'paid', 'approved', 'scheduled', 'completed'];

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  isSelected,
  onSelect,
  onApprove,
  onReschedule,
  onSchedule,
  onComplete,
  onCancel,
  isBlocked = false,
  blockReason = "Action blocked"
}) => {
  const getStepStatus = (step: string, currentStatus: string): 'completed' | 'current' | 'pending' => {
    const currentIndex = progressSteps.indexOf(currentStatus);
    const stepIndex = progressSteps.indexOf(step);

    if (currentStatus === 'cancelled') {
      return stepIndex === 0 ? 'completed' : 'pending';
    }

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const stepLabels = {
    requested: 'Requested',
    paid: 'Paid',
    approved: 'Approved',
    scheduled: 'Scheduled',
    completed: 'Completed'
  };

  // Render action buttons based on booking status
  const renderActionButtons = () => {
    // Common disabled styles
    const disabledClass = isBlocked ? "opacity-50 cursor-not-allowed" : "";

    // Cancel button for all actionable statuses
    const cancelButton = (
      <button
        onClick={onCancel}
        disabled={isBlocked}
        title={isBlocked ? blockReason : "Cancel booking"}
        className={`px-3 py-1.5 text-sm font-medium text-red-400 bg-[#0D0D0D] border border-red-700/50 rounded-lg transition-colors ${
          isBlocked ? disabledClass : "hover:border-red-500 hover:bg-red-900/20"
        }`}
      >
        Cancel
      </button>
    );

    // Reschedule button
    const rescheduleButton = (
      <button
        onClick={onReschedule}
        disabled={isBlocked}
        title={isBlocked ? blockReason : "Reschedule booking"}
        className={`px-3 py-1.5 text-sm font-medium text-gray-300 bg-[#0D0D0D] border border-gray-700 rounded-lg transition-colors ${
          isBlocked ? disabledClass : "hover:border-gray-500"
        }`}
      >
        Reschedule
      </button>
    );

    switch (booking.status) {
      case 'requested':
        return (
          <>
            {cancelButton}
          </>
        );
      case 'paid':
        return (
          <>
            {cancelButton}
            {rescheduleButton}
            <button
              onClick={onApprove}
              disabled={isBlocked}
              title={isBlocked ? blockReason : "Approve booking"}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                isBlocked
                  ? "bg-gray-700 text-gray-500 " + disabledClass
                  : "text-black bg-[#FFCC00] hover:bg-[#FFD700]"
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
          </>
        );
      case 'approved':
        return (
          <>
            {cancelButton}
            {rescheduleButton}
            <button
              onClick={onSchedule}
              disabled={isBlocked}
              title={isBlocked ? blockReason : "Mark as scheduled"}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                isBlocked
                  ? "bg-gray-700 text-gray-500 " + disabledClass
                  : "text-black bg-cyan-400 hover:bg-cyan-500"
              }`}
            >
              <Calendar className="w-4 h-4" />
              Mark Scheduled
            </button>
          </>
        );
      case 'scheduled':
        return (
          <>
            {cancelButton}
            {rescheduleButton}
            <button
              onClick={onComplete}
              disabled={isBlocked}
              title={isBlocked ? blockReason : "Mark as complete"}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                isBlocked
                  ? "bg-gray-700 text-gray-500 " + disabledClass
                  : "text-white bg-green-600 hover:bg-green-700"
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Mark Complete
            </button>
          </>
        );
      default:
        return null;
    }
  };

  const hasActions = ['requested', 'paid', 'approved', 'scheduled'].includes(booking.status);

  return (
    <div
      onClick={onSelect}
      className={`bg-[#1A1A1A] border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-[#FFCC00]/50 ${
        isSelected ? 'border-[#FFCC00] ring-1 ring-[#FFCC00]/30' : 'border-gray-800'
      }`}
    >
      {/* Header Row */}
      <div className="flex gap-3 mb-4">
        {/* Service Image */}
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
          {booking.serviceImageUrl ? (
            <img
              src={booking.serviceImageUrl}
              alt={booking.serviceName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
          )}
        </div>

        {/* Title and Customer */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{booking.serviceName}</h3>
          <p className="text-gray-400 text-sm truncate">
            {booking.customerName} • {truncateAddress(booking.customerAddress)}
          </p>
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}>
              <Clock className="w-3 h-3" />
              {getStatusLabel(booking.status)}
            </span>
            {booking.status !== 'requested' && booking.status !== 'cancelled' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                <CheckCircle className="w-3 h-3" />
                Paid
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4 text-sm">
        <div className="bg-[#0D0D0D] rounded-lg p-2">
          <p className="text-gray-500 text-xs">Booked</p>
          <p className="text-white font-medium">{formatDate(booking.bookedAt)}</p>
        </div>
        <div className="bg-[#0D0D0D] rounded-lg p-2">
          <p className="text-gray-500 text-xs">Service Date</p>
          <p className="text-white font-medium">{formatDate(booking.serviceDate)}</p>
        </div>
        <div className="bg-[#0D0D0D] rounded-lg p-2">
          <p className="text-gray-500 text-xs">Time</p>
          <p className="text-white font-medium">{formatTime12Hour(booking.serviceTime)}</p>
        </div>
        <div className="bg-[#0D0D0D] rounded-lg p-2">
          <p className="text-gray-500 text-xs">Cost</p>
          <p className="text-[#FFCC00] font-medium">${booking.amount.toFixed(2)}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          {progressSteps.map((step, index) => {
            const status = getStepStatus(step, booking.status);
            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full transition-colors ${
                      status === 'completed' ? 'bg-[#FFCC00]' :
                      status === 'current' ? 'bg-[#FFCC00] ring-2 ring-[#FFCC00]/30' :
                      'bg-gray-700'
                    }`}
                  />
                </div>
                {index < progressSteps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 ${
                      getStepStatus(progressSteps[index + 1], booking.status) === 'completed' ||
                      getStepStatus(progressSteps[index], booking.status) === 'completed'
                        ? 'bg-[#FFCC00]'
                        : 'bg-gray-700'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          {progressSteps.map(step => (
            <span key={step} className={getStepStatus(step, booking.status) === 'current' ? 'text-[#FFCC00]' : ''}>
              {stepLabels[step as keyof typeof stepLabels]}
            </span>
          ))}
        </div>
      </div>

      {/* Info Message */}
      {booking.status === 'paid' && (
        <div className="flex items-start gap-2 mb-4 p-3 bg-[#0D0D0D] rounded-lg border border-gray-800">
          <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-400">
            The customer has requested this service and is waiting for your response.
          </p>
        </div>
      )}
      {booking.status === 'approved' && (
        <div className="flex items-start gap-2 mb-4 p-3 bg-[#0D0D0D] rounded-lg border border-blue-800">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-400">
            Booking approved. Confirm the schedule to notify the customer.
          </p>
        </div>
      )}
      {booking.status === 'scheduled' && (
        <div className="flex items-start gap-2 mb-4 p-3 bg-[#0D0D0D] rounded-lg border border-cyan-800">
          <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-cyan-400">
            Service is scheduled. Mark complete after the service is done.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
        <span className="text-sm text-gray-500">
          Booking ID: <span className="text-white font-medium">{booking.bookingId}</span>
        </span>

        {hasActions && (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {renderActionButtons()}
          </div>
        )}
      </div>
    </div>
  );
};
