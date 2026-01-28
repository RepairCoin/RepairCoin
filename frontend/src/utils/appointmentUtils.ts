/**
 * Appointment utility functions for countdown calculations and directions
 */

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
  totalMinutes: number;
}

/**
 * Calculate countdown until appointment
 *
 * @param bookingDate - Date string in YYYY-MM-DD format
 * @param bookingTime - Time string in HH:MM format (optional)
 * @returns CountdownResult with days, hours, minutes, and isPast flag
 */
export function getCountdown(bookingDate: string, bookingTime?: string | null): CountdownResult {
  // Parse the booking date
  const [year, month, day] = bookingDate.split('-').map(Number);
  const appointmentDate = new Date(year, month - 1, day);

  // Add time if provided
  if (bookingTime) {
    const [hours, minutes] = bookingTime.split(':').map(Number);
    appointmentDate.setHours(hours, minutes, 0, 0);
  } else {
    // Default to start of day
    appointmentDate.setHours(0, 0, 0, 0);
  }

  const now = new Date();
  const diffMs = appointmentDate.getTime() - now.getTime();
  const isPast = diffMs < 0;

  // Calculate absolute difference
  const absDiffMs = Math.abs(diffMs);
  const totalMinutes = Math.floor(absDiffMs / (1000 * 60));
  const totalHours = Math.floor(absDiffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  return {
    days,
    hours,
    minutes,
    isPast,
    totalMinutes
  };
}

/**
 * Format countdown for display
 *
 * @param days - Number of days
 * @param hours - Number of hours
 * @param minutes - Number of minutes
 * @returns Formatted string like "5 days, 12 hrs, 30 mins"
 */
export function formatCountdown(days: number, hours: number, minutes: number): string {
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  }

  if (hours > 0 || days > 0) {
    parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`);
  }

  parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);

  return parts.join(', ');
}

/**
 * Get Google Maps directions URL for an address
 *
 * @param address - Street address to get directions to
 * @returns Google Maps URL for directions
 */
export function getDirectionsUrl(address: string): string {
  const encodedAddress = encodeURIComponent(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
}

/**
 * Format time from 24-hour to 12-hour format
 *
 * @param time - Time string in HH:MM format
 * @returns Time string in 12-hour format (e.g., "8:00AM")
 */
export function formatTime12Hour(time: string): string {
  if (!time) return '';
  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutesStr}${ampm}`;
}

/**
 * Format date for display in appointment card
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "Jan 06")
 */
export function formatAppointmentDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit'
  });
}

/**
 * Format date with full detail
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "Mon, Jan 06, 2026")
 */
export function formatFullDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
