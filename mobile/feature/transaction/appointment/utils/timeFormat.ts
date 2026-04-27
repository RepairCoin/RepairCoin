/**
 * Format a time string (HH:MM or HH:MM:SS) to 12-hour format
 */
export function formatTimeSlot(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${minutes} ${period}`;
}

/**
 * Format a time range from start and end time strings
 */
export function formatTimeRange(
  startTime: string | null,
  endTime: string | null
): string {
  if (!startTime) return "No time set";
  const start = formatTimeSlot(startTime);
  if (!endTime) return start;
  const end = formatTimeSlot(endTime);
  return `${start} - ${end}`;
}

/**
 * Format a date string (YYYY-MM-DD) to a readable format
 */
export function formatBookingDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
