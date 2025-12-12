// frontend/src/components/customer/DateAvailabilityPicker.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { appointmentsApi, ShopAvailability } from '@/services/api/appointments';

interface DateAvailabilityPickerProps {
  shopId: string;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
  maxAdvanceDays?: number;
}

export const DateAvailabilityPicker: React.FC<DateAvailabilityPickerProps> = ({
  shopId,
  selectedDate,
  onDateSelect,
  minDate = new Date(),
  maxAdvanceDays = 60
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shopAvailability, setShopAvailability] = useState<ShopAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShopAvailability();
  }, [shopId]);

  const loadShopAvailability = async () => {
    try {
      setLoading(true);
      const availability = await appointmentsApi.getShopAvailability(shopId);
      setShopAvailability(availability);
    } catch (error) {
      console.error('Error loading shop availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const isDateAvailable = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    const dayAvailability = shopAvailability.find(a => a.dayOfWeek === dayOfWeek);
    return dayAvailability?.isOpen || false;
  };

  const isDateSelectable = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // Check if date is in the past
    if (checkDate < today) return false;

    // Check if date is beyond max advance days
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
    if (checkDate > maxDate) return false;

    // Check if shop is open on this day
    return isDateAvailable(date);
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

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isSameDay = (date1: Date | null, date2: Date | null) => {
    if (!date1 || !date2) return false;
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return isSameDay(date, today);
  };

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        <span className="ml-2 text-gray-400">Loading calendar...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          type="button"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">
            {formatMonthYear(currentMonth)}
          </h3>
        </div>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          type="button"
        >
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map(day => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const selectable = isDateSelectable(date);
          const selected = isSameDay(date, selectedDate);
          const today = isToday(date);

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => selectable && onDateSelect(date)}
              disabled={!selectable}
              className={`
                aspect-square rounded-lg text-sm font-medium transition-all duration-200
                flex items-center justify-center relative
                ${
                  selected
                    ? 'bg-[#FFCC00] text-black ring-2 ring-[#FFCC00] ring-offset-2 ring-offset-[#1A1A1A]'
                    : selectable
                    ? 'bg-[#0D0D0D] text-white border border-gray-800 hover:border-[#FFCC00] hover:bg-[#2A2A2A]'
                    : 'bg-[#0A0A0A] text-gray-700 border border-gray-900 cursor-not-allowed'
                }
              `}
            >
              <span>{date.getDate()}</span>

              {/* Today indicator */}
              {today && !selected && (
                <div className="absolute bottom-1 w-1 h-1 bg-[#FFCC00] rounded-full" />
              )}

              {/* Available indicator */}
              {selectable && !selected && (
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-gray-400">Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-[#FFCC00] rounded-full" />
          <span className="text-gray-400">Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gray-700 rounded-full" />
          <span className="text-gray-400">Unavailable</span>
        </div>
      </div>
    </div>
  );
};
