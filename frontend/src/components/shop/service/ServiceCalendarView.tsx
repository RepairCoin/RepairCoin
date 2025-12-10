"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Clock, User, DollarSign } from 'lucide-react';
import { appointmentsApi, CalendarBooking } from '@/services/api/appointments';
import { ShopService } from '@/services/api/services';
import { toast } from 'react-hot-toast';

interface ServiceCalendarViewProps {
  serviceId: string;
  service: ShopService;
}

const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  confirmed: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  'in-progress': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  refunded: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  paid: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' }
};

export const ServiceCalendarView: React.FC<ServiceCalendarViewProps> = ({ serviceId, service }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allBookings, setAllBookings] = useState<CalendarBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);

  useEffect(() => {
    loadBookings();
  }, [currentDate, serviceId]);

  const loadBookings = async () => {
    try {
      setLoading(true);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];

      const data = await appointmentsApi.getShopCalendar(startDate, endDate);

      // Filter bookings for this specific service only
      const serviceBookings = data.filter(booking => booking.serviceId === serviceId);
      setAllBookings(serviceBookings);
    } catch (error: any) {
      console.error('Error loading bookings:', error);
      if (error.response?.status === 401) {
        toast.error('Please log in as a shop owner to view bookings');
      } else {
        toast.error('Failed to load bookings');
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

  const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const isToday = (dateStr: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const isCurrentMonth = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
  };

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();

    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const prevMonthLastDay = new Date(year, month, 0);
    const prevMonthDays = prevMonthLastDay.getDate();

    const days: { date: string; bookings: CalendarBooking[] }[] = [];

    // Previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(year, month - 1, day);
      days.push({
        date: date.toISOString().split('T')[0],
        bookings: []
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayBookings = allBookings.filter(b => b.bookingDate === dateStr);

      days.push({
        date: dateStr,
        bookings: dayBookings
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date: date.toISOString().split('T')[0],
        bookings: []
      });
    }

    return days;
  };

  const monthDays = getMonthDays();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-[#1A1A1A] border border-gray-800 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        <span className="ml-3 text-gray-400">Loading calendar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Service Bookings</h2>
          <p className="text-gray-400">
            Showing bookings for <span className="text-[#FFCC00]">{service.serviceName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-[#1A1A1A] text-white border border-gray-800 rounded-lg hover:bg-[#2A2A2A] transition-colors"
          >
            Today
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 bg-[#1A1A1A] text-white border border-gray-800 rounded-lg hover:bg-[#2A2A2A] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="text-white font-semibold min-w-[180px] text-center">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>

            <button
              onClick={() => navigateMonth('next')}
              className="p-2 bg-[#1A1A1A] text-white border border-gray-800 rounded-lg hover:bg-[#2A2A2A] transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {['pending', 'paid', 'completed', 'cancelled'].map(status => {
          const count = allBookings.filter(b => b.status === status).length;
          const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
          return (
            <div key={status} className={`bg-[#1A1A1A] border ${colors.border} rounded-lg p-4`}>
              <div className={`text-2xl font-bold ${colors.text} mb-1`}>{count}</div>
              <div className="text-sm text-gray-400 capitalize">{status}</div>
            </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-[#0D0D0D] border-b border-gray-800">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-sm font-semibold text-gray-400">
              {day}
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
                className={`min-h-[120px] border-r border-b border-gray-800 p-2 ${
                  !isInCurrentMonth ? 'bg-[#0A0A0A]' : ''
                } ${index % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm font-medium ${
                      isTodayDate
                        ? 'bg-[#FFCC00] text-black w-6 h-6 rounded-full flex items-center justify-center'
                        : isInCurrentMonth
                        ? 'text-white'
                        : 'text-gray-600'
                    }`}
                  >
                    {dayNumber}
                  </span>
                  {day.bookings.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {day.bookings.length}
                    </span>
                  )}
                </div>

                {/* Bookings */}
                <div className="space-y-1">
                  {day.bookings.slice(0, 3).map(booking => {
                    const colors = STATUS_COLORS[booking.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
                    return (
                      <button
                        key={booking.orderId}
                        onClick={() => setSelectedBooking(booking)}
                        className={`w-full text-left px-2 py-1 rounded ${colors.bg} ${colors.text} border ${colors.border} text-xs hover:opacity-80 transition-opacity`}
                      >
                        <div className="font-medium truncate">
                          {booking.bookingTimeSlot ? formatTime(booking.bookingTimeSlot) : 'No time'}
                        </div>
                        <div className="truncate opacity-90">
                          {booking.customerName || 'Customer'}
                        </div>
                      </button>
                    );
                  })}
                  {day.bookings.length > 3 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{day.bookings.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                    <div className="w-5 h-5 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Notes</div>
                      <div className="text-white">{selectedBooking.notes}</div>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 text-center pt-2">
                  Order ID: {selectedBooking.orderId}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
