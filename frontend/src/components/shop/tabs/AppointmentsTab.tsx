// frontend/src/components/shop/tabs/AppointmentsTab.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Loader2,
  CalendarClock,
  CalendarCheck,
  CalendarCheck2,
  CalendarX,
  ClockAlert,
  X,
  Calendar,
  RefreshCw,
  Plus
} from 'lucide-react';
import { appointmentsApi, CalendarBooking } from '@/services/api/appointments';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { RescheduleRequestsTab } from './RescheduleRequestsTab';
import { ManualBookingModal } from '../ManualBookingModal';
import { useAuthStore } from '@/stores/authStore';

interface DayBookings {
  date: string;
  bookings: CalendarBooking[];
}


interface AppointmentsTabProps {
  defaultSubTab?: 'appointments' | 'reschedules';
}

export const AppointmentsTab: React.FC<AppointmentsTabProps> = ({ defaultSubTab = 'appointments' }) => {
  const router = useRouter();
  const { userProfile } = useAuthStore();
  const [activeSubTab, setActiveSubTab] = useState<'appointments' | 'reschedules'>(defaultSubTab);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allBookings, setAllBookings] = useState<CalendarBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pendingRescheduleCount, setPendingRescheduleCount] = useState(0);

  // Manual booking modal state
  const [showManualBookingModal, setShowManualBookingModal] = useState(false);
  const [preSelectedBookingDate, setPreSelectedBookingDate] = useState<string | null>(null);

  // Fetch pending reschedule count for badge
  const fetchPendingCount = useCallback(async () => {
    try {
      const count = await appointmentsApi.getShopRescheduleRequestCount();
      setPendingRescheduleCount(count);
    } catch (error) {
      console.error('Error fetching pending reschedule count:', error);
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();

    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

  // Refresh count when switching away from reschedules tab (user may have approved/rejected)
  useEffect(() => {
    if (activeSubTab === 'appointments') {
      fetchPendingCount();
    }
  }, [activeSubTab, fetchPendingCount]);

  // Helper function to format date as YYYY-MM-DD without timezone conversion
  const formatDateLocal = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const loadBookings = useCallback(async () => {
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
      setAllBookings(data);
    } catch (error: unknown) {
      console.error('Error loading calendar:', error);
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 401) {
        toast.error('Please log in as a shop owner to view bookings');
      } else {
        toast.error('Failed to load calendar bookings');
      }
    } finally {
      setLoading(false);
    }
  }, [currentDate, formatDateLocal]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedDate(null); // Clear selection when changing months
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

  // Format date for display
  const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
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
      // Extract the date part from bookingDate using local timezone (consistent with Bookings tab)
      const dayBookings = allBookings.filter(b => {
        // Parse booking date as local time to match how Bookings tab displays it
        const bookingDateStr = typeof b.bookingDate === 'string' ? b.bookingDate : String(b.bookingDate);
        // Create date object - if it's an ISO string, it will be parsed as UTC and converted to local
        // If it's just a date string (YYYY-MM-DD), add time to ensure consistent parsing
        const bookingDate = new Date(bookingDateStr.includes('T') ? bookingDateStr : `${bookingDateStr}T12:00:00`);
        const bookingDateOnly = formatDateLocal(bookingDate);
        return bookingDateOnly === dateStr;
      });

      days.push({
        date: dateStr,
        bookings: dayBookings
      });
    }

    // Add next month's days to complete the grid (6 rows)
    const remainingDays = 42 - days.length;
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

  const formatTimeShort = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes.padStart(2, '0')}${ampm}`;
  };

  const isToday = (dateStr: string): boolean => {
    const today = new Date();
    const todayStr = formatDateLocal(today);
    return dateStr === todayStr;
  };


  const isCurrentMonth = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
  };

  const monthDays = getMonthDays();

  // Calculate stats
  const stats = useMemo(() => {
    const pending = allBookings.filter(b => b.status === 'pending').length;
    const confirmed = allBookings.filter(b =>
      b.status === 'confirmed' || b.status === 'paid' || b.status === 'approved' || b.status === 'scheduled'
    ).length;
    const completed = allBookings.filter(b => b.status === 'completed').length;
    const cancelled = allBookings.filter(b =>
      b.status === 'cancelled' || b.status === 'refunded'
    ).length;
    const noShow = allBookings.filter(b => b.status === 'no_show').length;
    return { pending, confirmed, completed, cancelled, noShow };
  }, [allBookings]);

  // Get appointments for selected date or all upcoming (today + future)
  const sidebarAppointments = useMemo(() => {
    const todayStr = formatDateLocal(new Date());

    // Sort by date then time function - uses local timezone for consistency
    const sortByDateTime = (a: CalendarBooking, b: CalendarBooking) => {
      const dateStrA = typeof a.bookingDate === 'string' ? a.bookingDate : String(a.bookingDate);
      const dateStrB = typeof b.bookingDate === 'string' ? b.bookingDate : String(b.bookingDate);
      const dateA = new Date(dateStrA.includes('T') ? dateStrA : `${dateStrA}T12:00:00`);
      const dateB = new Date(dateStrB.includes('T') ? dateStrB : `${dateStrB}T12:00:00`);
      const dateOnlyA = formatDateLocal(dateA);
      const dateOnlyB = formatDateLocal(dateB);
      if (dateOnlyA !== dateOnlyB) return dateOnlyA.localeCompare(dateOnlyB);
      const timeA = a.bookingTimeSlot || '00:00';
      const timeB = b.bookingTimeSlot || '00:00';
      return timeA.localeCompare(timeB);
    };

    // If a date is selected, show appointments for that date
    if (selectedDate) {
      const selectedBookings = allBookings.filter(b => {
        // Parse booking date as local time to match how Bookings tab displays it
        const bookingDateStr = typeof b.bookingDate === 'string' ? b.bookingDate : String(b.bookingDate);
        const bookingDate = new Date(bookingDateStr.includes('T') ? bookingDateStr : `${bookingDateStr}T12:00:00`);
        const bookingDateOnly = formatDateLocal(bookingDate);
        return bookingDateOnly === selectedDate;
      }).sort(sortByDateTime);

      return {
        mode: 'selected' as const,
        selectedDate,
        selectedBookings,
        upcoming: [] as CalendarBooking[]
      };
    }

    // Default: show all upcoming appointments (today and future)
    const upcoming: CalendarBooking[] = allBookings.filter(b => {
      // Parse booking date as local time to match how Bookings tab displays it
      const bookingDateStr = typeof b.bookingDate === 'string' ? b.bookingDate : String(b.bookingDate);
      const bookingDate = new Date(bookingDateStr.includes('T') ? bookingDateStr : `${bookingDateStr}T12:00:00`);
      const bookingDateOnly = formatDateLocal(bookingDate);
      // Include appointments from today onwards
      return bookingDateOnly >= todayStr;
    }).sort(sortByDateTime);

    return {
      mode: 'upcoming' as const,
      selectedDate: null,
      selectedBookings: [] as CalendarBooking[],
      upcoming
    };
  }, [allBookings, selectedDate, formatDateLocal]);

  // Group upcoming appointments by date for display
  const groupedUpcoming = useMemo(() => {
    if (sidebarAppointments.mode !== 'upcoming') return {};

    const groups: { [date: string]: CalendarBooking[] } = {};
    const todayStr = formatDateLocal(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateLocal(tomorrow);

    sidebarAppointments.upcoming.forEach(booking => {
      // Parse booking date as local time to match how Bookings tab displays it
      const bookingDateStr = typeof booking.bookingDate === 'string' ? booking.bookingDate : String(booking.bookingDate);
      const bookingDate = new Date(bookingDateStr.includes('T') ? bookingDateStr : `${bookingDateStr}T12:00:00`);
      const bookingDateOnly = formatDateLocal(bookingDate);

      let label = bookingDateOnly;
      if (bookingDateOnly === todayStr) {
        label = 'Today';
      } else if (bookingDateOnly === tomorrowStr) {
        label = 'Tomorrow';
      } else {
        // Format as "Mon, Jan 14"
        const date = new Date(bookingDateOnly + 'T00:00:00');
        label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(booking);
    });

    return groups;
  }, [sidebarAppointments, formatDateLocal]);

  // Handle date cell click
  const handleDateClick = (dateStr: string, hasBookings: boolean) => {
    if (selectedDate === dateStr) {
      // Clicking same date again deselects it
      setSelectedDate(null);
    } else if (hasBookings) {
      // Only select dates that have bookings
      setSelectedDate(dateStr);
    }
  };

  // Clear selected date
  const clearSelectedDate = () => {
    setSelectedDate(null);
  };

  // Generate booking ID from order ID (same logic as mockData.ts)
  const generateBookingId = (orderId: string): string => {
    const shortId = orderId.replace(/-/g, '').slice(-6).toUpperCase();
    return `BK-${shortId}`;
  };

  // Navigate to bookings tab with booking ID in search
  const navigateToBooking = (orderId: string) => {
    const bookingId = generateBookingId(orderId);
    router.push(`/shop?tab=bookings&search=${encodeURIComponent(bookingId)}`);
  };

  // Render appointment card
  const renderAppointmentCard = (booking: CalendarBooking) => {
    // Status-based styling for sidebar cards
    const getCardStatusStyles = () => {
      switch (booking.status) {
        case 'pending':
          return {
            iconColor: 'text-[#FFCC00]',
            badgeBg: 'bg-[#FFCC00]/20 text-[#FFCC00]',
            Icon: ClockAlert
          };
        case 'paid':
          return {
            iconColor: 'text-blue-400',
            badgeBg: 'bg-blue-500/20 text-blue-400',
            Icon: CalendarCheck2
          };
        case 'confirmed':
        case 'approved':
        case 'scheduled':
          return {
            iconColor: 'text-cyan-400',
            badgeBg: 'bg-cyan-500/20 text-cyan-400',
            Icon: CalendarCheck2
          };
        case 'completed':
          return {
            iconColor: 'text-green-400',
            badgeBg: 'bg-green-500/20 text-green-400',
            Icon: CalendarCheck
          };
        case 'cancelled':
        case 'refunded':
          return {
            iconColor: 'text-red-400',
            badgeBg: 'bg-red-500/20 text-red-400',
            Icon: CalendarX
          };
        case 'no_show':
          return {
            iconColor: 'text-orange-400',
            badgeBg: 'bg-orange-500/20 text-orange-400',
            Icon: CalendarX
          };
        default:
          return {
            iconColor: 'text-gray-400',
            badgeBg: 'bg-gray-500/20 text-gray-400',
            Icon: CalendarClock
          };
      }
    };

    const { iconColor, badgeBg, Icon } = getCardStatusStyles();

    return (
      <button
        key={booking.orderId}
        onClick={() => navigateToBooking(booking.orderId)}
        className="w-full text-left bg-[#0D0D0D] border border-gray-800 rounded-lg p-2 sm:p-3 hover:border-[#FFCC00]/50 hover:bg-[#1A1A1A] transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
          <span className="text-[#FFCC00] font-medium text-xs sm:text-sm truncate flex-1">
            {booking.serviceName}
          </span>
          <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${iconColor}`} />
        </div>
        <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="truncate max-w-[80px] sm:max-w-[100px]">{booking.customerName || 'Customer'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{booking.bookingTimeSlot ? formatTime(booking.bookingTimeSlot) : 'TBD'}</span>
          </div>
        </div>
        {/* Status badge */}
        <div className="mt-1.5 sm:mt-2 flex items-center gap-2">
          <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium ${badgeBg}`}>
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex gap-6 border-b border-gray-700">
        <button
          onClick={() => setActiveSubTab('appointments')}
          className={`pb-3 px-1 flex items-center gap-2 text-sm font-medium transition-colors ${
            activeSubTab === 'appointments'
              ? 'text-[#FFCC00] border-b-2 border-[#FFCC00]'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Calendar className="w-4 h-4" /> Appointments
        </button>
        <button
          onClick={() => setActiveSubTab('reschedules')}
          className={`pb-3 px-1 flex items-center gap-2 text-sm font-medium transition-colors ${
            activeSubTab === 'reschedules'
              ? 'text-[#FFCC00] border-b-2 border-[#FFCC00]'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <RefreshCw className="w-4 h-4" /> Reschedules
          {pendingRescheduleCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
              {pendingRescheduleCount > 99 ? '99+' : pendingRescheduleCount}
            </span>
          )}
        </button>
      </div>

      {/* Reschedules Sub-tab */}
      {activeSubTab === 'reschedules' && (
        <RescheduleRequestsTab />
      )}

      {/* Appointments Sub-tab */}
      {activeSubTab === 'appointments' && (<>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Pending Booking */}
        <div className="bg-[#FFCC00] rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/20 flex items-center justify-center flex-shrink-0">
            <ClockAlert className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-black/70 font-medium truncate">Pending</div>
            <div className="text-xl sm:text-2xl font-bold text-black">{stats.pending}</div>
          </div>
        </div>

        {/* Confirmed */}
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <CalendarCheck2 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-gray-400 font-medium truncate">Confirmed</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.confirmed}</div>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-gray-400 font-medium truncate">Completed</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.completed}</div>
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <CalendarX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-gray-400 font-medium truncate">Cancelled</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.cancelled}</div>
          </div>
        </div>

        {/* No Show */}
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 col-span-2 sm:col-span-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <CalendarX className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-gray-400 font-medium truncate">No Show</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.noShow}</div>
          </div>
        </div>
      </div>

      {/* Main Content: Calendar + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Calendar Section */}
        <div className="flex-1 bg-[#1A1A1A] border border-gray-800 rounded-xl overflow-hidden order-2 lg:order-1">
          {/* Calendar Header */}
          <div className="p-3 sm:p-4 flex items-center justify-between border-b border-gray-800">
            <h2 className="text-base sm:text-xl font-bold text-white">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => navigateMonth('next')}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 sm:py-20">
              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-[#FFCC00]" />
              <span className="ml-2 sm:ml-3 text-gray-400 text-sm sm:text-base">Loading calendar...</span>
            </div>
          ) : (
            <>
              {/* Day Headers */}
              <div className="grid grid-cols-7 bg-[#0D0D0D] border-b border-gray-800">
                {[
                  { short: 'S', full: 'SUN' },
                  { short: 'M', full: 'MON' },
                  { short: 'T', full: 'TUE' },
                  { short: 'W', full: 'WED' },
                  { short: 'T', full: 'THU' },
                  { short: 'F', full: 'FRI' },
                  { short: 'S', full: 'SAT' }
                ].map((day, idx) => (
                  <div key={idx} className="py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-500">
                    <span className="sm:hidden">{day.short}</span>
                    <span className="hidden sm:inline">{day.full}</span>
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {monthDays.map((day, index) => {
                  const isTodayDate = isToday(day.date);
                  const isInCurrentMonth = isCurrentMonth(day.date);
                  const dayNumber = new Date(day.date).getDate();
                  const uniqueCustomers = new Set(day.bookings.map(b => b.customerAddress)).size;
                  const hasBookings = day.bookings.length > 0;
                  const isSelected = selectedDate === day.date;

                  return (
                    <div
                      key={index}
                      onClick={() => handleDateClick(day.date, hasBookings)}
                      className={`group relative min-h-[60px] sm:min-h-[100px] lg:min-h-[140px] border-r border-b border-gray-800 p-1 sm:p-2 transition-colors ${
                        !isInCurrentMonth ? 'bg-[#0A0A0A]' : ''
                      } ${index % 7 === 6 ? 'border-r-0' : ''} ${
                        hasBookings ? 'cursor-pointer hover:bg-[#252525]' : 'hover:bg-[#1A1A1A]'
                      } ${isSelected ? 'bg-[#252525] ring-1 ring-[#FFCC00]' : ''}`}
                    >
                      {/* Day Number & Customer Count */}
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <span
                          className={`text-xs sm:text-sm font-semibold ${
                            isTodayDate
                              ? 'bg-[#FFCC00] text-black w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-sm'
                              : isInCurrentMonth
                              ? 'text-white'
                              : 'text-gray-600'
                          }`}
                        >
                          {dayNumber}
                        </span>
                        {uniqueCustomers > 0 && (
                          <div className="hidden sm:flex items-center gap-1 text-gray-400">
                            <User className="w-3.5 h-3.5" />
                            <span className="text-xs">{uniqueCustomers}</span>
                          </div>
                        )}
                      </div>

                      {/* Quick-add button on hover for days in current month */}
                      {isInCurrentMonth && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreSelectedBookingDate(day.date);
                            setShowManualBookingModal(true);
                          }}
                          className="absolute top-1 right-1 w-5 h-5 sm:w-6 sm:h-6 bg-[#FFCC00] text-black rounded-full
                                     flex items-center justify-center opacity-0 group-hover:opacity-100
                                     transition-opacity text-xs sm:text-sm font-bold hover:bg-[#FFD700] hover:scale-110
                                     shadow-lg z-10"
                          title={`Book appointment for ${day.date}`}
                        >
                          +
                        </button>
                      )}

                      {/* Appointment Badges - Mobile shows dots, desktop shows full badges */}
                      {/* Mobile: Show dots only */}
                      <div className="sm:hidden flex flex-wrap gap-1">
                        {day.bookings.slice(0, 3).map(booking => {
                          const dotColor = (() => {
                            switch (booking.status) {
                              case 'pending': return 'bg-[#FFCC00]';
                              case 'paid': return 'bg-blue-400';
                              case 'confirmed':
                              case 'approved':
                              case 'scheduled': return 'bg-cyan-400';
                              case 'completed': return 'bg-green-400';
                              case 'cancelled':
                              case 'refunded': return 'bg-red-400';
                              case 'no_show': return 'bg-orange-400';
                              default: return 'bg-gray-400';
                            }
                          })();
                          return (
                            <div key={booking.orderId} className={`w-2 h-2 rounded-full ${dotColor}`} />
                          );
                        })}
                        {day.bookings.length > 3 && (
                          <span className="text-[8px] text-gray-500">+{day.bookings.length - 3}</span>
                        )}
                      </div>

                      {/* Desktop: Show full badges */}
                      <div className="hidden sm:block space-y-1">
                        {day.bookings.slice(0, 4).map(booking => {
                          // Status-based styling
                          const getStatusStyles = () => {
                            switch (booking.status) {
                              case 'pending':
                                return {
                                  bg: 'bg-[#FFCC00]/20 text-[#FFCC00]',
                                  Icon: ClockAlert
                                };
                              case 'paid':
                                return {
                                  bg: 'bg-blue-500/20 text-blue-400',
                                  Icon: CalendarCheck2
                                };
                              case 'confirmed':
                              case 'approved':
                              case 'scheduled':
                                return {
                                  bg: 'bg-cyan-500/20 text-cyan-400',
                                  Icon: CalendarCheck2
                                };
                              case 'completed':
                                return {
                                  bg: 'bg-green-500/20 text-green-400',
                                  Icon: CalendarCheck
                                };
                              case 'cancelled':
                              case 'refunded':
                                return {
                                  bg: 'bg-red-500/20 text-red-400',
                                  Icon: CalendarX
                                };
                              case 'no_show':
                                return {
                                  bg: 'bg-orange-500/20 text-orange-400',
                                  Icon: CalendarX
                                };
                              default:
                                return {
                                  bg: 'bg-gray-500/20 text-gray-400',
                                  Icon: CalendarClock
                                };
                            }
                          };

                          const { bg, Icon } = getStatusStyles();

                          return (
                            <div
                              key={booking.orderId}
                              className={`w-full text-left px-2 py-1 rounded flex items-center justify-between gap-1 text-[10px] ${bg}`}
                            >
                              <span className="truncate font-medium">
                                {booking.bookingTimeSlot ? formatTimeShort(booking.bookingTimeSlot) : 'TBD'}
                              </span>
                              <Icon className="w-3 h-3 flex-shrink-0" />
                            </div>
                          );
                        })}
                        {day.bookings.length > 4 && (
                          <div className="text-[10px] text-gray-500 text-center">
                            +{day.bookings.length - 4} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Sidebar - Shows above calendar on mobile */}
        <div className="w-full lg:w-[320px] bg-[#1A1A1A] border border-gray-800 rounded-xl overflow-hidden lg:flex-shrink-0 order-1 lg:order-2">
          {/* Sidebar Header */}
          <div className="p-3 sm:p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#FFCC00]">
                <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-semibold text-sm sm:text-base">
                  {sidebarAppointments.mode === 'selected' ? 'Appointments' : 'Upcoming'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Book Appointment Button */}
                <button
                  onClick={() => {
                    setPreSelectedBookingDate(selectedDate);
                    setShowManualBookingModal(true);
                  }}
                  className="px-3 py-1.5 bg-[#FFCC00] text-black text-xs font-semibold rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-1"
                  title="Book new appointment"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Book</span>
                </button>
                {selectedDate && (
                  <button
                    onClick={clearSelectedDate}
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 max-h-[300px] lg:max-h-[600px] overflow-y-auto">
            {/* Selected Date View */}
            {sidebarAppointments.mode === 'selected' && selectedDate && (
              <>
                <div className="text-sm text-gray-400 font-medium">
                  {formatDateDisplay(selectedDate)} ({sidebarAppointments.selectedBookings.length})
                </div>
                {sidebarAppointments.selectedBookings.length > 0 ? (
                  <div className="space-y-3">
                    {sidebarAppointments.selectedBookings.map(booking => renderAppointmentCard(booking))}
                  </div>
                ) : (
                  <div className="text-center py-4 sm:py-6">
                    <p className="text-gray-500 text-xs sm:text-sm">No appointments on this date</p>
                  </div>
                )}
              </>
            )}

            {/* Upcoming View (Today & Future) */}
            {sidebarAppointments.mode === 'upcoming' && (
              <>
                {Object.keys(groupedUpcoming).length > 0 ? (
                  Object.entries(groupedUpcoming).map(([dateLabel, bookings], groupIndex) => (
                    <div key={dateLabel}>
                      <div className={`text-sm text-gray-400 font-medium ${groupIndex > 0 ? 'mt-4' : ''}`}>
                        {dateLabel} ({bookings.length})
                      </div>
                      <div className="space-y-3 mt-2">
                        {bookings.map(booking => renderAppointmentCard(booking))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 sm:py-8">
                    <CalendarClock className="w-8 h-8 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-2 sm:mb-3" />
                    <p className="text-gray-400 text-xs sm:text-sm">No upcoming appointments</p>
                    <p className="text-gray-500 text-[10px] sm:text-xs mt-1">Future appointments will appear here</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      </>)}

      {/* Manual Booking Modal */}
      {userProfile?.shopId && (
        <ManualBookingModal
          shopId={userProfile.shopId}
          isOpen={showManualBookingModal}
          onClose={() => {
            setShowManualBookingModal(false);
            setPreSelectedBookingDate(null);
          }}
          onSuccess={() => {
            loadBookings(); // Refresh calendar after successful booking
          }}
          preSelectedDate={preSelectedBookingDate || undefined}
        />
      )}
    </div>
  );
};

export default AppointmentsTab;
