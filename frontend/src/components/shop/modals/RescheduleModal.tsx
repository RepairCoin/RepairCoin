"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, Loader2 } from "lucide-react";
import { ServiceOrderWithDetails } from "@/services/api/services";
import { appointmentsApi } from "@/services/api/appointments";

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
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Get minimum date (today + 1 day)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  // Get maximum date (60 days from now)
  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);
    return maxDate.toISOString().split("T")[0];
  };

  // Load available time slots when date changes
  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate]);

  const loadAvailableSlots = async () => {
    setLoadingSlots(true);
    setSelectedTime("");
    try {
      const slots = await appointmentsApi.getAvailableTimeSlots(
        shopId,
        order.serviceId,
        selectedDate
      );
      // Extract available time slots from the response
      const availableTimes = slots
        .filter(slot => slot.available)
        .map(slot => slot.time);
      setAvailableSlots(availableTimes);
    } catch (error) {
      console.error("Error loading time slots:", error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    await onReschedule(selectedDate, selectedTime, reason || undefined);
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#1A1A1A] border border-gray-800 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Reschedule Booking</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Current booking info */}
        <div className="bg-[#101010] rounded-lg p-4 mb-6">
          <p className="text-xs text-gray-500 mb-2">Current Appointment</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-white">{formatDate(order.bookingDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-white">
                {formatTime(order.bookingTime || order.bookingTimeSlot || "")}
              </span>
            </div>
          </div>
        </div>

        {/* New date selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              New Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={getMinDate()}
              max={getMaxDate()}
              className="w-full px-4 py-3 bg-[#101010] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]/50"
            />
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Available Times
              </label>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No available slots for this date</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedTime === slot
                          ? "bg-[#FFCC00] text-black"
                          : "bg-[#101010] text-white border border-gray-700 hover:border-[#FFCC00]/50"
                      }`}
                    >
                      {formatTime(slot)}
                    </button>
                  ))}
                </div>
              )}
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
              className="w-full px-4 py-3 bg-[#101010] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#FFCC00]/50 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-transparent border border-gray-700 rounded-lg text-white font-medium hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedDate || !selectedTime || isProcessing}
            className="flex-1 px-4 py-3 bg-[#FFCC00] rounded-lg text-black font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
