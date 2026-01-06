import { BookingStatus } from "@/interfaces/booking.interfaces";

export function getStatusColor(status: BookingStatus): string {
  switch (status) {
    case "completed":
      return "#22c55e";
    case "paid":
      return "#3b82f6";
    case "pending":
      return "#eab308";
    case "cancelled":
      return "#ef4444";
    default:
      return "#666";
  }
}

export function formatBookingTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
}
