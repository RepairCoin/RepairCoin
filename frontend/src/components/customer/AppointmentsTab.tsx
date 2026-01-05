"use client";

import React, { useState, useEffect } from 'react';
import {Calendar, Clock, DollarSign, Loader2, XCircle, Edit2, Star, MessageSquare, RefreshCw } from 'lucide-react';
import { appointmentsApi, CalendarBooking, RescheduleRequest } from '@/services/api/appointments';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { formatLocalDate } from '@/utils/dateUtils';
import { RescheduleModal } from './RescheduleModal';

export const AppointmentsTab: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<CalendarBooking[]>([]);
  const [activeView, setActiveView] = useState<'upcoming' | 'past'>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<CalendarBooking | null>(null);
  const [pendingReschedules, setPendingReschedules] = useState<Map<string, RescheduleRequest>>(new Map());

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      // Get appointments from 30 days ago to 90 days in the future
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90);

      const data = await appointmentsApi.getCustomerAppointments(
        formatLocalDate(startDate),
        formatLocalDate(endDate)
      );

      setAppointments(data);

      // Load pending reschedule requests for upcoming appointments
      const upcomingOrderIds = data
        .filter(a => ['paid', 'confirmed'].includes(a.status))
        .map(a => a.orderId);

      if (upcomingOrderIds.length > 0) {
        await loadPendingReschedules(upcomingOrderIds);
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment? This action cannot be undone.')) {
      return;
    }

    try {
      setCancellingId(orderId);
      await appointmentsApi.cancelAppointment(orderId);
      toast.success('Appointment cancelled successfully');
      loadAppointments();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast.error('Failed to cancel appointment');
    } finally {
      setCancellingId(null);
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

  const isUpcoming = (appointment: CalendarBooking): boolean => {
    const appointmentDate = new Date(appointment.bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const status = appointment.status.toLowerCase();
    return appointmentDate >= today && status !== 'completed' && status !== 'cancelled';
  };

  const canCancel = (appointment: CalendarBooking): boolean => {
    const appointmentDate = new Date(appointment.bookingDate);
    const now = new Date();
    const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const status = appointment.status.toLowerCase();
    return hoursUntil >= 24 && status !== 'completed' && status !== 'cancelled';
  };

  const canReview = (appointment: CalendarBooking): boolean => {
    return appointment.status.toLowerCase() === 'completed';
  };

  const canReschedule = (appointment: CalendarBooking): boolean => {
    // Parse booking date - handle both ISO strings and date objects
    const bookingDateStr = appointment.bookingDate;
    const appointmentDate = new Date(bookingDateStr);

    // Check for invalid date
    if (isNaN(appointmentDate.getTime())) {
      console.warn('Invalid booking date:', bookingDateStr);
      return false;
    }

    const now = new Date();
    const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const status = appointment.status.toLowerCase();
    // Allow reschedule if 24+ hours before and status is paid/confirmed
    return hoursUntil >= 24 && ['paid', 'confirmed'].includes(status);
  };

  const hasPendingReschedule = (orderId: string): boolean => {
    return pendingReschedules.has(orderId);
  };

  const loadPendingReschedules = async (orderIds: string[]) => {
    const pendingMap = new Map<string, RescheduleRequest>();

    // Check each order for pending reschedule requests
    await Promise.all(
      orderIds.map(async (orderId) => {
        try {
          const request = await appointmentsApi.getRescheduleRequestForOrder(orderId);
          if (request) {
            pendingMap.set(orderId, request);
          }
        } catch {
          // Silently ignore - appointment might not have a pending request
        }
      })
    );

    setPendingReschedules(pendingMap);
  };

  const upcomingAppointments = appointments.filter(isUpcoming);
  const pastAppointments = appointments.filter(a => !isUpcoming(a));

  const STATUS_COLORS = {
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    confirmed: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    'in-progress': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    completed: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    paid: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' } // Paid = Confirmed (blue)
  };

  const renderAppointment = (appointment: CalendarBooking) => {
    const statusColors = STATUS_COLORS[appointment.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;

    return (
      <div
        key={appointment.orderId}
        className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6 hover:border-[#FFCC00]/30 transition-all duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-1">{appointment.serviceName}</h3>
            <p className="text-sm text-gray-400">{appointment.shopId}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors.bg} ${statusColors.text} border ${statusColors.border}`}>
            {appointment.status.toUpperCase()}
          </span>
        </div>

        {/* Pending Reschedule Banner */}
        {hasPendingReschedule(appointment.orderId) && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-400 font-medium">
                Reschedule request pending approval
              </span>
            </div>
          </div>
        )}

        {/* Date & Time */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar className="w-4 h-4 text-[#FFCC00]" />
            <span className="text-sm">{formatDate(appointment.bookingDate)}</span>
          </div>
          {appointment.bookingTimeSlot && (
            <div className="flex items-center gap-2 text-gray-300">
              <Clock className="w-4 h-4 text-[#FFCC00]" />
              <span className="text-sm">
                {formatTime(appointment.bookingTimeSlot)}
                {appointment.bookingEndTime && ` - ${formatTime(appointment.bookingEndTime)}`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-300">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-sm font-semibold">${appointment.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        {appointment.notes && (
          <div className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-400">
              <span className="text-gray-500 font-semibold">Notes:</span> {appointment.notes}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-800">
          {/* Reschedule Button */}
          {isUpcoming(appointment) && canReschedule(appointment) && (
            <button
              onClick={() => setRescheduleAppointment(appointment)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                hasPendingReschedule(appointment.orderId)
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30'
                  : 'bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30'
              }`}
            >
              <Edit2 className="w-4 h-4" />
              {hasPendingReschedule(appointment.orderId) ? 'View Request' : 'Reschedule'}
            </button>
          )}

          {isUpcoming(appointment) && canCancel(appointment) && (
            <button
              onClick={() => handleCancelAppointment(appointment.orderId)}
              disabled={cancellingId === appointment.orderId}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {cancellingId === appointment.orderId ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Cancel
                </>
              )}
            </button>
          )}

          {canReview(appointment) && (
            <button
              onClick={() => router.push(`/customer/orders?orderId=${appointment.orderId}`)}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00]/20 text-[#FFCC00] border border-[#FFCC00]/30 rounded-lg hover:bg-[#FFCC00]/30 transition-colors text-sm"
            >
              <Star className="w-4 h-4" />
              Leave Review
            </button>
          )}

          <button
            onClick={() => router.push(`/customer/orders?orderId=${appointment.orderId}`)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700/20 text-gray-400 border border-gray-700/30 rounded-lg hover:bg-gray-700/30 transition-colors text-sm ml-auto"
          >
            <MessageSquare className="w-4 h-4" />
            View Details
          </button>
        </div>

        {/* Cancellation notice */}
        {isUpcoming(appointment) && !canCancel(appointment) && appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
          <div className="mt-3 text-xs text-gray-500 bg-gray-800/50 border border-gray-700 rounded-lg p-2">
            ⚠️ Cancellation is only available 24+ hours before the appointment
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        <span className="ml-3 text-gray-400">Loading appointments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">My Appointments</h1>
        <p className="text-gray-400">View and manage your service bookings</p>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 border-b border-gray-800">
        <button
          onClick={() => setActiveView('upcoming')}
          className={`px-6 py-3 font-semibold transition-colors relative ${
            activeView === 'upcoming'
              ? 'text-[#FFCC00]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Upcoming ({upcomingAppointments.length})
          {activeView === 'upcoming' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
          )}
        </button>
        <button
          onClick={() => setActiveView('past')}
          className={`px-6 py-3 font-semibold transition-colors relative ${
            activeView === 'past'
              ? 'text-[#FFCC00]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Past ({pastAppointments.length})
          {activeView === 'past' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
          )}
        </button>
      </div>

      {/* Appointments List */}
      {activeView === 'upcoming' && (
        <div className="space-y-4">
          {upcomingAppointments.length === 0 ? (
            <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold text-white mb-2">No Upcoming Appointments</h3>
              <p className="text-gray-400 mb-6">
                Book a service from the marketplace to get started!
              </p>
              <button
                onClick={() => router.push('/customer?tab=marketplace')}
                className="px-6 py-3 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all"
              >
                Browse Services
              </button>
            </div>
          ) : (
            upcomingAppointments.map(renderAppointment)
          )}
        </div>
      )}

      {activeView === 'past' && (
        <div className="space-y-4">
          {pastAppointments.length === 0 ? (
            <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold text-white mb-2">No Past Appointments</h3>
              <p className="text-gray-400">
                Your completed and cancelled appointments will appear here
              </p>
            </div>
          ) : (
            pastAppointments.map(renderAppointment)
          )}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleAppointment && (
        <RescheduleModal
          appointment={rescheduleAppointment}
          onClose={() => setRescheduleAppointment(null)}
          onSuccess={() => {
            setRescheduleAppointment(null);
            loadAppointments();
          }}
        />
      )}
    </div>
  );
};
