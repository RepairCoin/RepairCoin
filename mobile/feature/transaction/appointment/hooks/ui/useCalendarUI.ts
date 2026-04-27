import { useState, useCallback } from "react";

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
  const selectDateFromCalendar = useCallback(
    (day: number) => {
      const newDate = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth(),
        day
      );
      setSelectedDate(newDate);
      setShowFullCalendar(false);
    },
    [calendarMonth]
  );

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
  const selectYear = useCallback(
    (year: number) => {
      const newDate = new Date(calendarMonth);
      newDate.setFullYear(year);
      setCalendarMonth(newDate);
    },
    [calendarMonth]
  );

  // Select month in picker
  const selectMonth = useCallback(
    (monthIndex: number) => {
      const newDate = new Date(calendarMonth);
      newDate.setMonth(monthIndex);
      setCalendarMonth(newDate);
      setShowYearMonthPicker(false);
    },
    [calendarMonth]
  );

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
