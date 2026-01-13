"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, Loader2, RefreshCw } from "lucide-react";
import { ServiceOrderWithDetails } from "@/services/api/services";
import { appointmentsApi, TimeSlotConfig } from "@/services/api/appointments";
import { DateAvailabilityPicker } from "@/components/customer/DateAvailabilityPicker";
import { TimeSlotPicker } from "@/components/customer/TimeSlotPicker";
import { formatLocalDate } from "@/utils/dateUtils";

interface RescheduleModalProps {
  order: ServiceOrderWithDetails;
  shopId: string;
  onReschedule: (newDate: string, newTime: string, reason?: string) => Promise<void>;
  onClose: () => void;
  isProcessing: boolean;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  order,
  shopId,
  onReschedule,
  onClose,
  isProcessing,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [timeSlotConfig, setTimeSlotConfig] = useState<TimeSlotConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    loadTimeSlotConfig();
  }, [shopId]);

  const loadTimeSlotConfig = async () => {
    try {
      setLoadingConfig(true);
      const config = await appointmentsApi.getTimeSlotConfig();
      setTimeSlotConfig(config);
    } catch (error) {
      console.error("Error loading time slot config:", error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTimeSlot) return;
    const dateStr = formatLocalDate(selectedDate);
    await onReschedule(dateStr, selectedTimeSlot, reason || undefined);
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return "-";
    const [hours, minutes] = timeString.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loadingConfig) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative bg-[#1A1A1A] border border-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
            <span className="ml-3 text-gray-400">Loading calendar...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0D0D0D] border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#0D0D0D] z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#FFCC00]" />
            Reschedule Booking
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current booking info */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-3">Current Appointment</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-white">{formatDate(order.bookingDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-white">
                  {formatTime(order.bookingTime || order.bookingTimeSlot)}
                </span>
              </div>
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Select New Date
            </h3>
            <DateAvailabilityPicker
              shopId={shopId}
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                setSelectedDate(date);
                setSelectedTimeSlot(null); // Reset time when date changes
              }}
              maxAdvanceDays={timeSlotConfig?.bookingAdvanceDays || 60}
              minBookingHours={0} // Shop can schedule same-day
              allowWeekendBooking={timeSlotConfig?.allowWeekendBooking ?? true}
            />
          </div>

          {/* Time Slot Picker */}
          {selectedDate && (
            <div>
              <TimeSlotPicker
                shopId={shopId}
                serviceId={order.serviceId}
                selectedDate={selectedDate}
                selectedTimeSlot={selectedTimeSlot}
                onTimeSlotSelect={setSelectedTimeSlot}
                shopTimezone={timeSlotConfig?.timezone || "America/New_York"}
              />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Reason for Rescheduling (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Shop unavailable, customer request..."
              rows={3}
              className="w-full px-4 py-3 bg-[#1A1A1A] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#FFCC00]/50 resize-none"
            />
          </div>

          {/* Summary when date and time selected */}
          {selectedDate && selectedTimeSlot && (
            <div className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-[#FFCC00] mb-3">New Appointment</h4>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#FFCC00]" />
                  <span className="text-sm text-white">{formatDate(formatLocalDate(selectedDate))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FFCC00]" />
                  <span className="text-sm text-white">{formatTime(selectedTimeSlot)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-800 sticky bottom-0 bg-[#0D0D0D]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-transparent border border-gray-700 rounded-xl text-white font-medium hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedDate || !selectedTimeSlot || isProcessing}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] rounded-xl text-black font-semibold hover:from-[#FFD700] hover:to-[#FFCC00] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rescheduling...
              </>
            ) : (
              "Confirm Reschedule"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
