"use client";

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getCountdown, formatCountdown } from '@/utils/appointmentUtils';

interface CountdownBadgeProps {
  bookingDate: string;
  bookingTime?: string | null;
  className?: string;
}

export const CountdownBadge: React.FC<CountdownBadgeProps> = ({
  bookingDate,
  bookingTime,
  className = ''
}) => {
  const [countdown, setCountdown] = useState(() => getCountdown(bookingDate, bookingTime));

  useEffect(() => {
    // Update countdown every 60 seconds
    const interval = setInterval(() => {
      setCountdown(getCountdown(bookingDate, bookingTime));
    }, 60000);

    return () => clearInterval(interval);
  }, [bookingDate, bookingTime]);

  // Don't show badge if appointment is in the past
  if (countdown.isPast) {
    return null;
  }

  const countdownText = formatCountdown(countdown.days, countdown.hours, countdown.minutes);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-[#FFCC00]/20 border border-[#FFCC00]/40 rounded-full ${className}`}
    >
      <Clock className="w-3.5 h-3.5 text-[#FFCC00]" />
      <span className="text-xs font-semibold text-[#FFCC00]">
        Upcoming in {countdownText}
      </span>
    </div>
  );
};
