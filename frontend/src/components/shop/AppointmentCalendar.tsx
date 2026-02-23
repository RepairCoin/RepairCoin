// frontend/src/components/shop/AppointmentCalendar.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Clock, MapPin, User, DollarSign, Plus } from 'lucide-react';
import { appointmentsApi, CalendarBooking } from '@/services/api/appointments';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { ManualBookingModal } from './ManualBookingModal';
import { useAuthStore } from '@/stores/authStore';

interface DayBookings {
  date: string;
  bookings: CalendarBooking[];
}

const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  confirmed: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  'in-progress': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  refunded: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  paid: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' } // Paid = Confirmed (blue)
};

interface AppointmentCalendarProps {
  serviceId?: string;
  serviceName?: string;
}

export const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({ serviceId, serviceName }) => {
  const router = useRouter();
  const { userProfile } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allBookings, setAllBookings] = useState<CalendarBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [showManualBookingModal, setShowManualBookingModal] = useState(false);

  useEffect(() => {
    loadBookings();
  }, [currentDate, serviceId]);

  const loadBookings = async () => {
    try {
      setLoading(true);

      // Get first and last day of current month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const startDate = formatDateLocal(firstDay);
      const endDate = formatDateLocal(lastDay);

      const data = await appointmentsApi.getShopCalendar(startDate, endDate);

      // Filter by serviceId if provided
      const filteredBookings = serviceId
        ? data.filter(booking => booking.serviceId === serviceId)
        : data;

      setAllBookings(filteredBookings);
    } catch (error: any) {
      console.error('Error loading calendar:', error);
      if (error.response?.status === 401) {
        toast.error('Please log in as a shop owner to view bookings');
      } else {
        toast.error('Failed to load calendar bookings');
      }
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Helper function to format date as YYYY-MM-DD without timezone conversion
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getMonthDays = (): DayBookings[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get first day of month and its day of week
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();

    // Get last day of month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get last month's days to fill the beginning
    const prevMonthLastDay = new Date(year, month, 0);
    const prevMonthDays = prevMonthLastDay.getDate();

    const days: DayBookings[] = [];

    // Add previous month's days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(year, month - 1, day);
      days.push({
        date: formatDateLocal(date),
        bookings: []
      });
    }

    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDateLocal(date);
      // Extract just the date part from bookingDate (might be "2025-12-17T00:00:00.000Z" or "2025-12-17")
      const dayBookings = allBookings.filter(b => {
        // Handle both string and Date types, and extract date portion safely
        const bookingDateStr = typeof b.bookingDate === 'string' ? b.bookingDate : String(b.bookingDate);
        const bookingDateOnly = bookingDateStr.split('T')[0].split(' ')[0]; // Handle both ISO and space-separated format
        return bookingDateOnly === dateStr;
      });

      days.push({
        date: dateStr,
        bookings: dayBookings
      });
    }

    // Add next month's days to complete the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date: formatDateLocal(date),
        bookings: []
      });
    }

    return days;
  };

  const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const isToday = (dateStr: string): boolean => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
  };

  const isCurrentMonth = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
  };

  const monthDays = getMonthDays();

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            {serviceName ? 'Service Bookings' : 'Appointment Calendar'}
          </h1>
          <p className="text-sm sm:text-base text-gray-400">
            {serviceName ? (
              <>Showing bookings for <span className="text-[#FFCC00] truncate">{serviceName}</span></>
            ) : (
              'View and manage your bookings'
            )}
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
          <button
            onClick={() => setShowManualBookingModal(true)}
            className="px-3 sm:px-4 py-2 bg-[#FFCC00] text-black text-sm sm:text-base font-semibold rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Book Appointment</span>
            <span className="sm:hidden">Book</span>
          </button>

          <button
            onClick={goToToday}
            className="px-3 sm:px-4 py-2 bg-[#1A1A1A] text-white text-sm sm:text-base border border-gray-800 rounded-lg hover:bg-[#2A2A2A] transition-colors"
          >
            Today
          </button>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1.5 sm:p-2 bg-[#1A1A1A] text-white border border-gray-800 rounded-lg hover:bg-[#2A2A2A] transition-colors"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <span className="text-white text-sm sm:text-base font-semibold min-w-[120px] sm:min-w-[180px] text-center">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>

            <button
              onClick={() => navigateMonth('next')}
              className="p-1.5 sm:p-2 bg-[#1A1A1A] text-white border border-gray-800 rounded-lg hover:bg-[#2A2A2A] transition-colors"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6">
        {['pending', 'confirmed', 'completed', 'cancelled'].map(status => {
          // Count 'paid' bookings as 'confirmed' since paid = confirmed
          const count = allBookings.filter(b => {
            if (status === 'confirmed') {
              return b.status === 'confirmed' || b.status === 'paid';
            }
            return b.status === status;
          }).length;
          const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
          return (
            <div key={status} className={`bg-[#1A1A1A] border ${colors.border} rounded-lg p-3 sm:p-4`}>
              <div className={`text-xl sm:text-2xl font-bold ${colors.text} mb-1`}>{count}</div>
              <div className="text-xs sm:text-sm text-gray-400 capitalize">{status}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 bg-[#1A1A1A] border border-gray-800 rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
          <span className="ml-3 text-gray-400">Loading calendar...</span>
        </div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg overflow-hidden overflow-x-auto">
            <div className="min-w-[500px]">
              {/* Day Headers */}
              <div className="grid grid-cols-7 bg-[#0D0D0D] border-b border-gray-800">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <div key={day} className="py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-400">
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day.charAt(0)}</span>
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {monthDays.map((day, index) => {
                  const isTodayDate = isToday(day.date);
                  const isInCurrentMonth = isCurrentMonth(day.date);
                  const dayNumber = new Date(day.date).getDate();

                  return (
                    <div
                      key={index}
                      className={`min-h-[80px] sm:min-h-[120px] border-r border-b border-gray-800 p-1 sm:p-2 ${
                        !isInCurrentMonth ? 'bg-[#0A0A0A]' : ''
                      } ${index % 7 === 6 ? 'border-r-0' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <span
                          className={`text-xs sm:text-sm font-medium ${
                            isTodayDate
                              ? 'bg-[#FFCC00] text-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center'
                              : isInCurrentMonth
                              ? 'text-white'
                              : 'text-gray-600'
                          }`}
                        >
                          {dayNumber}
                        </span>
                        {day.bookings.length > 0 && (
                          <span className="text-[10px] sm:text-xs text-gray-400">
                            {day.bookings.length}
                          </span>
                        )}
                      </div>

                      {/* Bookings for this day */}
                      <div className="space-y-0.5 sm:space-y-1">
                        {day.bookings.slice(0, 2).map(booking => {
                          const colors = STATUS_COLORS[booking.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
                          return (
                            <button
                              key={booking.orderId}
                              onClick={() => {
                                // Navigate to the service calendar page
                                router.push(`/shop/services/${booking.serviceId}?tab=calendar`);
                              }}
                              className={`w-full text-left px-1 sm:px-2 py-0.5 sm:py-1 rounded ${colors.bg} ${colors.text} border ${colors.border} text-[10px] sm:text-xs hover:opacity-80 transition-opacity`}
                            >
                              <div className="font-medium truncate">
                                {booking.bookingTimeSlot ? formatTime(booking.bookingTimeSlot) : 'No time'}
                              </div>
                              <div className="truncate opacity-90 font-semibold hidden sm:block">
                                {booking.customerName || 'Customer'}
                              </div>
                            </button>
                          );
                        })}
                        {day.bookings.length > 2 && (
                          <div className="text-[10px] sm:text-xs text-gray-500 text-center">
                            +{day.bookings.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedBooking(null)}
        >
          <div
            className="bg-[#1A1A1A] border border-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">{selectedBooking.serviceName}</h2>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        STATUS_COLORS[selectedBooking.status as keyof typeof STATUS_COLORS]?.bg
                      } ${STATUS_COLORS[selectedBooking.status as keyof typeof STATUS_COLORS]?.text} border ${
                        STATUS_COLORS[selectedBooking.status as keyof typeof STATUS_COLORS]?.border
                      }`}
                    >
                      {selectedBooking.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>

              {/* Booking Details */}
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-[#0D0D0D] rounded-lg">
                  <CalendarIcon className="w-5 h-5 text-[#FFCC00] mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Date & Time</div>
                    <div className="text-white font-medium">
                      {new Date(selectedBooking.bookingDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    {selectedBooking.bookingTimeSlot && (
                      <div className="text-white flex items-center gap-2 mt-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {formatTime(selectedBooking.bookingTimeSlot)}
                        {selectedBooking.bookingEndTime && ` - ${formatTime(selectedBooking.bookingEndTime)}`}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-[#0D0D0D] rounded-lg">
                  <User className="w-5 h-5 text-[#FFCC00] mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Customer</div>
                    <div className="text-white font-medium">
                      {selectedBooking.customerName || 'Anonymous'}
                    </div>
                    <div className="text-gray-400 text-sm mt-1">
                      {selectedBooking.customerAddress.substring(0, 10)}...
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-[#0D0D0D] rounded-lg">
                  <DollarSign className="w-5 h-5 text-[#FFCC00] mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Amount</div>
                    <div className="text-white font-medium">
                      ${selectedBooking.totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {selectedBooking.notes && (
                  <div className="flex items-start gap-3 p-3 bg-[#0D0D0D] rounded-lg">
                    <MapPin className="w-5 h-5 text-[#FFCC00] mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Notes</div>
                      <div className="text-white">{selectedBooking.notes}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-[#0D0D0D] rounded-lg">
                  <Clock className="w-5 h-5 text-[#FFCC00] mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Order ID</div>
                    <div className="text-white font-mono text-sm">
                      {selectedBooking.orderId}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 text-center pt-2">
                  Booked on {new Date(selectedBooking.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Booking Modal */}
      <ManualBookingModal
        shopId={userProfile?.id || ''}
        isOpen={showManualBookingModal}
        onClose={() => setShowManualBookingModal(false)}
        onSuccess={() => {
          loadBookings(); // Reload calendar after successful booking
        }}
        preSelectedService={
          serviceId && serviceName
            ? { serviceId, serviceName }
            : undefined
        }
      />
    </div>
  );
};
