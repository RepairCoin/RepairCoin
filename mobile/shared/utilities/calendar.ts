/**
 * Shared calendar, date, and time formatting utilities
 * Used by appointment and booking features
 */

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

export function getDaysInMonth(date: Date): {
  firstDay: number;
  daysInMonth: number;
} {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

export function getScrollableDays(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  const currentDay = today.getDay();

  // Start from 2 weeks ago (Sunday of that week)
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - currentDay - 14);

  // Generate 42 days (6 weeks): 2 weeks past + 4 weeks ahead — ensures the
  // full current month is reachable regardless of when today falls in it.
  for (let i = 0; i < 42; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }
  return days;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isDateSelected(date: Date, selectedDate: Date): boolean {
  return (
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear()
  );
}

export function formatTime12h(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
