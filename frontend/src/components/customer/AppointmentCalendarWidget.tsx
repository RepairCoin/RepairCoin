"use client";

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarBooking } from '@/services/api/appointments';

interface AppointmentCalendarWidgetProps {
  appointments: CalendarBooking[];
  className?: string;
}

export const AppointmentCalendarWidget: React.FC<AppointmentCalendarWidgetProps> = ({
  appointments,
  className = ''
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get dates that have appointments (only future/upcoming ones)
  const appointmentDateStrings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateStrings = new Set<string>();

    appointments.forEach(apt => {
      const [year, month, day] = apt.bookingDate.split('-').map(Number);
      const aptDate = new Date(year, month - 1, day);
      if (aptDate >= today && !['cancelled', 'completed'].includes(apt.status.toLowerCase())) {
        dateStrings.add(apt.bookingDate);
      }
    });

    return dateStrings;
  }, [appointments]);

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const hasAppointment = (date: Date): boolean => {
    return appointmentDateStrings.has(formatDateString(date));
  };

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className={`bg-[#1A1A1A] border border-gray-800 rounded-2xl p-4 ${className}`}>
      {/* Header with Title */}
      <h3 className="text-lg font-semibold text-white mb-4">Calendar</h3>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          type="button"
        >
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        </button>
        <span className="text-sm font-semibold text-white">
          {formatMonthYear(currentMonth)}
        </span>
        <button
          onClick={goToNextMonth}
          className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          type="button"
        >
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day, index) => (
          <div
            key={`${day}-${index}`}
            className="text-center text-xs font-medium text-gray-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const today = isToday(date);
          const hasAppt = hasAppointment(date);

          return (
            <div
              key={date.toISOString()}
              className={`
                aspect-square rounded-lg text-xs font-medium
                flex items-center justify-center
                ${
                  today
                    ? 'bg-[#FFCC00] text-black'
                    : hasAppt
                    ? 'bg-[#FFCC00]/20 text-[#FFCC00] border border-[#FFCC00]/40'
                    : 'text-gray-400 hover:bg-gray-800'
                }
              `}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-3 h-3 rounded bg-[#FFCC00]"></div>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-3 h-3 rounded bg-[#FFCC00]/20 border border-[#FFCC00]/40"></div>
          <span>Appointment scheduled</span>
        </div>
      </div>
    </div>
  );
};
