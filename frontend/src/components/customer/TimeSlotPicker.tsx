// frontend/src/components/customer/TimeSlotPicker.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Loader2, Calendar } from 'lucide-react';
import { appointmentsApi, TimeSlot } from '@/services/api/appointments';
import { toast } from 'react-hot-toast';
import { formatLocalDate } from '@/utils/dateUtils';

interface TimeSlotPickerProps {
  shopId: string;
  serviceId: string;
  selectedDate: Date | null;
  selectedTimeSlot: string | null;
  onTimeSlotSelect: (timeSlot: string) => void;
  shopTimezone?: string; // IANA timezone identifier (e.g., 'America/New_York')
}

// Map timezone identifiers to user-friendly labels
const getTimezoneLabel = (timezone: string): string => {
  const labels: Record<string, string> = {
    'America/New_York': 'ET',
    'America/Chicago': 'CT',
    'America/Denver': 'MT',
    'America/Los_Angeles': 'PT',
    'America/Anchorage': 'AKT',
    'Pacific/Honolulu': 'HT',
    'America/Phoenix': 'AZ',
    'UTC': 'UTC'
  };
  return labels[timezone] || timezone.split('/').pop()?.replace('_', ' ') || timezone;
};

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  shopId,
  serviceId,
  selectedDate,
  selectedTimeSlot,
  onTimeSlotSelect,
  shopTimezone = 'America/New_York'
}) => {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedDate && shopId && serviceId) {
      loadTimeSlots();
    } else {
      setTimeSlots([]);
    }
  }, [selectedDate, shopId, serviceId]);

  const loadTimeSlots = async () => {
    if (!selectedDate) return;

    try {
      setLoading(true);
      const dateStr = formatLocalDate(selectedDate); // YYYY-MM-DD
      const slots = await appointmentsApi.getAvailableTimeSlots(shopId, serviceId, dateStr);
      setTimeSlots(slots);
      // UI message already shows "No available time slots" - no need for toast
    } catch (error) {
      console.error('Error loading time slots:', error);
      toast.error('Failed to load available time slots');
      setTimeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string): string => {
    // Convert HH:MM to 12-hour format
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (!selectedDate) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Please select a date first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        <span className="ml-2 text-gray-400">Loading available times...</span>
      </div>
    );
  }

  if (timeSlots.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-500" />
        <p className="text-gray-400 mb-2">No available time slots</p>
        <p className="text-sm text-gray-500">Please choose a different date</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Select a Time
          <span className="text-xs font-normal text-gray-400">
            ({getTimezoneLabel(shopTimezone)})
          </span>
        </h4>
        <span className="text-xs text-gray-400">
          {timeSlots.filter(s => s.available).length} of {timeSlots.length} available
        </span>
      </div>

      {/* Timezone notice */}
      <div className="text-xs text-gray-500 mb-3 bg-gray-800/30 rounded-lg px-3 py-2">
        Times shown in shop timezone ({getTimezoneLabel(shopTimezone)})
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
        {timeSlots.map((slot) => {
          const isSelected = selectedTimeSlot === slot.time;
          const isAvailable = slot.available;

          return (
            <button
              key={slot.time}
              type="button"
              onClick={() => isAvailable && onTimeSlotSelect(slot.time)}
              disabled={!isAvailable}
              className={`
                relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${
                  isSelected
                    ? 'bg-[#FFCC00] text-black ring-2 ring-[#FFCC00] ring-offset-2 ring-offset-[#0A0A0A]'
                    : isAvailable
                    ? 'bg-[#1A1A1A] text-white border border-gray-800 hover:border-[#FFCC00] hover:bg-[#2A2A2A]'
                    : 'bg-[#0F0F0F] text-gray-600 border border-gray-900 cursor-not-allowed'
                }
              `}
            >
              <div className="flex flex-col items-center">
                <span className={isSelected ? 'font-bold' : ''}>
                  {formatTime(slot.time)}
                </span>
                {!isAvailable && (
                  <span className="text-[10px] mt-1">Full</span>
                )}
              </div>

              {/* Availability indicator dot */}
              {isAvailable && !isSelected && (
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected time summary */}
      {selectedTimeSlot && (
        <div className="mt-4 p-3 bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-[#FFCC00]" />
            <span className="text-white">
              Selected: <span className="font-semibold">{formatTime(selectedTimeSlot)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
