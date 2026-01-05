// frontend/src/components/customer/RescheduleModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import { CalendarBooking, appointmentsApi, RescheduleRequest, TimeSlotConfig } from '@/services/api/appointments';
import { DateAvailabilityPicker } from './DateAvailabilityPicker';
import { TimeSlotPicker } from './TimeSlotPicker';
import { formatLocalDate } from '@/utils/dateUtils';
import { toast } from 'react-hot-toast';

interface RescheduleModalProps {
  appointment: CalendarBooking;
  onClose: () => void;
  onSuccess: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  appointment,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'select' | 'confirm' | 'success'>('select');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<RescheduleRequest | null>(null);
  const [checkingPending, setCheckingPending] = useState(true);
  const [timeSlotConfig, setTimeSlotConfig] = useState<TimeSlotConfig | null>(null);

  useEffect(() => {
    checkPendingRequest();
    loadTimeSlotConfig();
  }, [appointment.orderId, appointment.shopId]);

  const loadTimeSlotConfig = async () => {
    try {
      const config = await appointmentsApi.getPublicTimeSlotConfig(appointment.shopId);
      setTimeSlotConfig(config);
    } catch (error) {
      console.error('Error loading time slot config:', error);
    }
  };

  const checkPendingRequest = async () => {
    try {
      setCheckingPending(true);
      const request = await appointmentsApi.getRescheduleRequestForOrder(appointment.orderId);
      setPendingRequest(request);
    } catch (error) {
      console.error('Error checking pending request:', error);
    } finally {
      setCheckingPending(false);
    }
  };

  const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTimeSlot) {
      toast.error('Please select a date and time');
      return;
    }

    try {
      setSubmitting(true);
      await appointmentsApi.createRescheduleRequest(
        appointment.orderId,
        formatLocalDate(selectedDate),
        selectedTimeSlot,
        reason || undefined
      );
      setStep('success');
      toast.success('Reschedule request submitted!');
    } catch (error: unknown) {
      console.error('Error creating reschedule request:', error);
      const axiosError = error as { response?: { data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to submit reschedule request';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPendingRequest = async () => {
    if (!pendingRequest) return;

    if (!confirm('Are you sure you want to cancel this reschedule request?')) {
      return;
    }

    try {
      setSubmitting(true);
      await appointmentsApi.cancelRescheduleRequest(pendingRequest.requestId);
      toast.success('Reschedule request cancelled');
      setPendingRequest(null);
    } catch (error: unknown) {
      console.error('Error cancelling request:', error);
      toast.error('Failed to cancel reschedule request');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingPending) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#0D0D0D] border border-gray-800 rounded-2xl p-8 max-w-md w-full">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
            <span className="ml-3 text-gray-400">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show pending request status
  if (pendingRequest) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#0D0D0D] border border-gray-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-[#FFCC00]" />
              Pending Reschedule
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-semibold mb-1">Request Pending Approval</p>
                  <p className="text-sm text-gray-400">
                    You have a pending reschedule request waiting for shop approval.
                    You can cancel it to submit a new one.
                  </p>
                </div>
              </div>
            </div>

            {/* Current Appointment */}
            <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-3">Current Appointment</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>{formatDate(pendingRequest.originalDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>{formatTime(pendingRequest.originalTimeSlot)}</span>
                </div>
              </div>
            </div>

            {/* Requested New Time */}
            <div className="bg-[#1A1A1A] border border-[#FFCC00]/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-[#FFCC00] mb-3">Requested New Time</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white">
                  <Calendar className="w-4 h-4 text-[#FFCC00]" />
                  <span>{formatDate(pendingRequest.requestedDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Clock className="w-4 h-4 text-[#FFCC00]" />
                  <span>{formatTime(pendingRequest.requestedTimeSlot)}</span>
                </div>
              </div>
            </div>

            {pendingRequest.customerReason && (
              <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Your Reason</h4>
                <p className="text-white text-sm">{pendingRequest.customerReason}</p>
              </div>
            )}

            {/* Expiry Info */}
            {pendingRequest.expiresAt && (
              <p className="text-xs text-gray-500 text-center">
                Request expires: {new Date(pendingRequest.expiresAt).toLocaleString()}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-gray-800">
            <button
              onClick={handleCancelPendingRequest}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-red-600/20 text-red-400 border border-red-600/30 rounded-xl hover:bg-red-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </span>
              ) : (
                'Cancel Request'
              )}
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-700/20 text-white border border-gray-700/30 rounded-xl hover:bg-gray-700/30 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#0D0D0D] border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Request Submitted!</h2>
          <p className="text-gray-400 mb-6">
            Your reschedule request has been sent to the shop for approval.
            You&apos;ll be notified once they respond.
          </p>
          <button
            onClick={() => {
              onSuccess();
              onClose();
            }}
            className="w-full px-6 py-3 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#0D0D0D] z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#FFCC00]" />
            Reschedule Appointment
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
          {/* Current Appointment Info */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Current Appointment</h3>
            <div className="space-y-2">
              <p className="text-white font-semibold">{appointment.serviceName}</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="w-4 h-4 text-[#FFCC00]" />
                  <span>{formatDate(appointment.bookingDate)}</span>
                </div>
                {appointment.bookingTimeSlot && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock className="w-4 h-4 text-[#FFCC00]" />
                    <span>{formatTime(appointment.bookingTimeSlot)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notice */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-semibold text-blue-400 mb-1">Shop Approval Required</p>
                <p>Your reschedule request will be sent to the shop for approval. You&apos;ll be notified when they respond.</p>
              </div>
            </div>
          </div>

          {step === 'select' && (
            <>
              {/* Date Picker */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Select New Date
                </h3>
                <DateAvailabilityPicker
                  shopId={appointment.shopId}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  maxAdvanceDays={timeSlotConfig?.bookingAdvanceDays || 30}
                  minBookingHours={timeSlotConfig?.minBookingHours || 0}
                  allowWeekendBooking={timeSlotConfig?.allowWeekendBooking ?? true}
                />
              </div>

              {/* Time Slot Picker */}
              {selectedDate && (
                <div>
                  <TimeSlotPicker
                    shopId={appointment.shopId}
                    serviceId={appointment.serviceId}
                    selectedDate={selectedDate}
                    selectedTimeSlot={selectedTimeSlot}
                    onTimeSlotSelect={setSelectedTimeSlot}
                  />
                </div>
              )}

              {/* Reason (Optional) */}
              <div>
                <label className="text-sm font-semibold text-white mb-2 block">
                  Reason for Rescheduling (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Let the shop know why you need to reschedule..."
                  rows={3}
                  className="w-full bg-[#1A1A1A] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none transition-colors resize-none"
                />
              </div>
            </>
          )}

          {step === 'confirm' && selectedDate && selectedTimeSlot && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Confirm Your Request</h3>

              <div className="grid gap-4">
                <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">From</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-white">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>{formatDate(appointment.bookingDate)}</span>
                    </div>
                    {appointment.bookingTimeSlot && (
                      <div className="flex items-center gap-2 text-white">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span>{formatTime(appointment.bookingTimeSlot)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-center">
                  <RefreshCw className="w-5 h-5 text-[#FFCC00]" />
                </div>

                <div className="bg-[#1A1A1A] border border-[#FFCC00]/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-[#FFCC00] mb-2">To</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-white">
                      <Calendar className="w-4 h-4 text-[#FFCC00]" />
                      <span>{formatDate(formatLocalDate(selectedDate))}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <Clock className="w-4 h-4 text-[#FFCC00]" />
                      <span>{formatTime(selectedTimeSlot)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {reason && (
                <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Reason</h4>
                  <p className="text-white text-sm">{reason}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-800 sticky bottom-0 bg-[#0D0D0D]">
          {step === 'select' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-700/20 text-white border border-gray-700/30 rounded-xl hover:bg-gray-700/30 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!selectedDate || !selectedTimeSlot}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button
                onClick={() => setStep('select')}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-gray-700/20 text-white border border-gray-700/30 rounded-xl hover:bg-gray-700/30 transition-colors font-semibold disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  'Submit Request'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
