"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { appointmentsApi, CalendarBooking, RescheduleRequest } from '@/services/api/appointments';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { formatLocalDate } from '@/utils/dateUtils';
import { RescheduleModal } from './RescheduleModal';
import { CancelBookingModal, CancelOrderData } from './CancelBookingModal';
import { AppointmentCard } from './AppointmentCard';
import { AppointmentCalendarWidget } from './AppointmentCalendarWidget';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type FilterTab = 'upcoming' | 'completed' | 'cancelled';
type SortOrder = 'asc' | 'desc';

export const AppointmentsTab: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<CalendarBooking[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('upcoming');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [cancelAppointment, setCancelAppointment] = useState<CalendarBooking | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<CalendarBooking | null>(null);
  const [pendingReschedules, setPendingReschedules] = useState<Map<string, RescheduleRequest>>(new Map());

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      // Get appointments from 90 days ago to 90 days in the future
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90);

      const data = await appointmentsApi.getCustomerAppointments(
        formatLocalDate(startDate),
        formatLocalDate(endDate)
      );

      setAppointments(data);

      // Load pending reschedule requests for upcoming appointments
      const upcomingOrderIds = data
        .filter(a => ['paid', 'confirmed'].includes(a.status.toLowerCase()))
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

  const loadPendingReschedules = async (orderIds: string[]) => {
    const pendingMap = new Map<string, RescheduleRequest>();

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

  // Filter and count appointments
  const { upcomingAppointments, completedAppointments, cancelledAppointments } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming: CalendarBooking[] = [];
    const completed: CalendarBooking[] = [];
    const cancelled: CalendarBooking[] = [];

    appointments.forEach((apt) => {
      const status = apt.status.toLowerCase();
      const [year, month, day] = apt.bookingDate.split('-').map(Number);
      const aptDate = new Date(year, month - 1, day);

      if (status === 'cancelled') {
        cancelled.push(apt);
      } else if (status === 'completed') {
        completed.push(apt);
      } else if (aptDate >= today) {
        upcoming.push(apt);
      } else {
        // Past appointments that aren't completed/cancelled go to completed
        completed.push(apt);
      }
    });

    return {
      upcomingAppointments: upcoming,
      completedAppointments: completed,
      cancelledAppointments: cancelled
    };
  }, [appointments]);

  // Get filtered appointments based on active tab
  const filteredAppointments = useMemo(() => {
    let list: CalendarBooking[];

    switch (activeFilter) {
      case 'upcoming':
        list = upcomingAppointments;
        break;
      case 'completed':
        list = completedAppointments;
        break;
      case 'cancelled':
        list = cancelledAppointments;
        break;
      default:
        list = upcomingAppointments;
    }

    // Sort by date
    return [...list].sort((a, b) => {
      const dateA = new Date(a.bookingDate).getTime();
      const dateB = new Date(b.bookingDate).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [activeFilter, upcomingAppointments, completedAppointments, cancelledAppointments, sortOrder]);

  const handleCancelAppointment = (appointment: CalendarBooking) => {
    setCancelAppointment(appointment);
  };

  const getCancelOrderData = (appointment: CalendarBooking): CancelOrderData => ({
    orderId: appointment.orderId,
    serviceName: appointment.serviceName,
    shopId: appointment.shopId,
    shopName: appointment.shopName,
    totalAmount: appointment.totalAmount,
    serviceImageUrl: appointment.serviceImage
  });

  const canCancelAppointment = (appointment: CalendarBooking): boolean => {
    const [year, month, day] = appointment.bookingDate.split('-').map(Number);
    const appointmentDate = new Date(year, month - 1, day);
    const now = new Date();
    const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const status = appointment.status.toLowerCase();
    return hoursUntil >= 24 && status !== 'completed' && status !== 'cancelled';
  };

  const canRescheduleAppointment = (appointment: CalendarBooking): boolean => {
    const status = appointment.status.toLowerCase();
    return ['paid', 'confirmed', 'scheduled'].includes(status);
  };

  const hasPendingReschedule = (orderId: string): boolean => {
    return pendingReschedules.has(orderId);
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
      {/* Main Content */}
      <div className="flex gap-6">
        {/* Left: Filters + Cards */}
        <div className="flex-1 min-w-0">
          {/* Filter Tabs + Sort */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            {/* Filter Tabs */}
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={() => setActiveFilter('upcoming')}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  activeFilter === 'upcoming'
                    ? 'bg-[#FFCC00] text-black'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                }`}
              >
                Upcoming ({upcomingAppointments.length})
              </button>
              <button
                onClick={() => setActiveFilter('completed')}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  activeFilter === 'completed'
                    ? 'bg-[#FFCC00] text-black'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                }`}
              >
                Completed ({completedAppointments.length})
              </button>
              <button
                onClick={() => setActiveFilter('cancelled')}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  activeFilter === 'cancelled'
                    ? 'bg-[#FFCC00] text-black'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                }`}
              >
                Cancelled ({cancelledAppointments.length})
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 self-end sm:self-auto whitespace-nowrap flex-shrink-0">
              <span className="text-sm text-gray-500">Sort by:</span>
              <Select
                value={sortOrder}
                onValueChange={(value) => setSortOrder(value as SortOrder)}
              >
                <SelectTrigger className="w-[100px] bg-transparent border border-gray-700 text-white h-9 rounded-lg hover:border-gray-500 transition-colors">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-gray-800">
                  <SelectItem value="asc" className="text-white hover:bg-gray-800 focus:bg-gray-800 focus:text-white">
                    Date ↑
                  </SelectItem>
                  <SelectItem value="desc" className="text-white hover:bg-gray-800 focus:bg-gray-800 focus:text-white">
                    Date ↓
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Appointment Cards */}
          <div className="space-y-4">
            {filteredAppointments.length === 0 ? (
              <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  {activeFilter === 'upcoming'
                    ? 'No Upcoming Appointments'
                    : activeFilter === 'completed'
                    ? 'No Completed Appointments'
                    : 'No Cancelled Appointments'}
                </h3>
                <p className="text-gray-400 mb-6">
                  {activeFilter === 'upcoming'
                    ? 'Book a service from the marketplace to get started!'
                    : activeFilter === 'completed'
                    ? 'Your completed appointments will appear here.'
                    : 'Your cancelled appointments will appear here.'}
                </p>
                {activeFilter === 'upcoming' && (
                  <button
                    onClick={() => router.push('/customer?tab=marketplace')}
                    className="px-6 py-3 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all"
                  >
                    Browse Services
                  </button>
                )}
              </div>
            ) : (
              filteredAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.orderId}
                  appointment={appointment}
                  onReschedule={() => setRescheduleAppointment(appointment)}
                  onCancel={() => handleCancelAppointment(appointment)}
                  hasPendingReschedule={hasPendingReschedule(appointment.orderId)}
                  showActions={activeFilter === 'upcoming'}
                  canCancel={canCancelAppointment(appointment)}
                  canReschedule={canRescheduleAppointment(appointment)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Calendar Widget (desktop only) */}
        <div className="w-80 hidden lg:block flex-shrink-0">
          <div className="sticky top-6">
            <AppointmentCalendarWidget appointments={appointments} />
          </div>
        </div>
      </div>

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

      {/* Cancel Booking Modal */}
      <CancelBookingModal
        order={cancelAppointment ? getCancelOrderData(cancelAppointment) : null}
        isOpen={!!cancelAppointment}
        onClose={() => setCancelAppointment(null)}
        onSuccess={() => {
          setCancelAppointment(null);
          loadAppointments();
        }}
      />
    </div>
  );
};
