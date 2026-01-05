import { useState, useCallback } from "react";
import { BookingFilterStatus } from "./useBookingsQuery";
import { BookingStatus } from "@/interfaces/booking.interfaces";

export const BOOKING_STATUS_FILTERS: { label: string; value: BookingFilterStatus }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Completed", value: "completed" },
];

export function useBookingsUI() {
  const [statusFilter, setStatusFilter] = useState<BookingFilterStatus>("all");

  return {
    statusFilter,
    setStatusFilter,
  };
}

export function useCalendarUI() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Open full calendar modal
  const openFullCalendar = useCallback(() => {
    setCalendarMonth(selectedDate);
    setShowFullCalendar(true);
  }, [selectedDate]);

  // Close full calendar modal
  const closeFullCalendar = useCallback(() => {
    setShowFullCalendar(false);
    setShowYearMonthPicker(false);
  }, []);

  // Select date from calendar and close modal
  const selectDateFromCalendar = useCallback((day: number) => {
    const newDate = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      day
    );
    setSelectedDate(newDate);
    setShowFullCalendar(false);
  }, [calendarMonth]);

  // Navigate to previous month
  const goToPreviousMonth = useCallback(() => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(calendarMonth.getMonth() - 1);
    if (newMonth.getFullYear() >= 2024) {
      setCalendarMonth(newMonth);
    }
  }, [calendarMonth]);

  // Navigate to next month
  const goToNextMonth = useCallback(() => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(calendarMonth.getMonth() + 1);
    if (newMonth.getFullYear() <= 2030) {
      setCalendarMonth(newMonth);
    }
  }, [calendarMonth]);

  // Select year in picker
  const selectYear = useCallback((year: number) => {
    const newDate = new Date(calendarMonth);
    newDate.setFullYear(year);
    setCalendarMonth(newDate);
  }, [calendarMonth]);

  // Select month in picker
  const selectMonth = useCallback((monthIndex: number) => {
    const newDate = new Date(calendarMonth);
    newDate.setMonth(monthIndex);
    setCalendarMonth(newDate);
    setShowYearMonthPicker(false);
  }, [calendarMonth]);

  // Go to today
  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
    setShowFullCalendar(false);
  }, []);

  return {
    // Selected date
    selectedDate,
    setSelectedDate,
    // Full calendar modal
    showFullCalendar,
    openFullCalendar,
    closeFullCalendar,
    // Year/month picker
    showYearMonthPicker,
    setShowYearMonthPicker,
    // Calendar month navigation
    calendarMonth,
    goToPreviousMonth,
    goToNextMonth,
    selectYear,
    selectMonth,
    // Actions
    selectDateFromCalendar,
    goToToday,
  };
}

// Helper functions
export const getStatusColor = (status: BookingStatus): string => {
  switch (status) {
    case "completed": return "#22c55e";
    case "paid": return "#3b82f6";
    case "pending": return "#eab308";
    case "cancelled": return "#ef4444";
    default: return "#666";
  }
};

export const formatBookingTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

export const isDateSelected = (date: Date, selectedDate: Date): boolean => {
  return (
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear()
  );
};

export const getDaysInMonth = (date: Date): { firstDay: number; daysInMonth: number } => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
};

export const getScrollableDays = (): Date[] => {
  const days: Date[] = [];
  const today = new Date();
  const currentDay = today.getDay();

  // Start from 6 weeks ago (Sunday of that week)
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - currentDay - 42);

  // Generate 84 days (12 weeks)
  for (let i = 0; i < 84; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }
  return days;
};

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
export const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
