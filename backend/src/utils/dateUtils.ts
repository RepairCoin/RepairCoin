/**
 * Date utility functions for handling local timezone dates on the backend
 *
 * CRITICAL: These functions avoid toISOString() which converts to UTC,
 * causing date shifts for users in positive UTC offset timezones.
 *
 * Example of the bug:
 * - User in Asia (UTC+8) selects Dec 24, 2024
 * - toISOString() converts to UTC: Dec 23, 2024 16:00:00Z
 * - split('T')[0] extracts: "2024-12-23" (wrong date!)
 *
 * These functions preserve the user's local timezone throughout.
 */

/**
 * Parse a YYYY-MM-DD string as a local Date object at midnight
 *
 * IMPORTANT: Creates date at midnight in LOCAL timezone, not UTC
 *
 * This is critical for date comparisons and database queries where
 * we want to match the user's intended date, not UTC date.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object at midnight local time
 *
 * @example
 * // Server in UTC+8
 * parseLocalDateString("2024-12-24"); // Dec 24, 2024 00:00:00 local time
 * // NOT Dec 24, 2024 00:00:00 UTC (which would be Dec 24, 08:00 local)
 */
export function parseLocalDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);

  // Month is 0-indexed in Date constructor
  return new Date(year, month - 1, day);
}

/**
 * Format a Date object as YYYY-MM-DD string in LOCAL timezone
 *
 * IMPORTANT: Does NOT use toISOString() which would convert to UTC
 *
 * Use this when storing or comparing dates that should represent
 * the user's local calendar date, not UTC date.
 *
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format (local timezone)
 *
 * @example
 * // Server in UTC+8 on Dec 24, 2024 at 10:00 AM
 * const date = new Date(2024, 11, 24, 10, 0);
 * formatLocalDate(date); // "2024-12-24" (correct!)
 * // NOT "2024-12-23" (which date.toISOString().split('T')[0] would give)
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Combine a date string and time string into a single Date object
 *
 * Creates a Date object representing the specified date and time
 * in the LOCAL timezone.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timeStr - Time string in HH:MM format (24-hour)
 * @returns Date object with combined date and time
 *
 * @example
 * createDateTime("2024-12-24", "14:30");
 * // Dec 24, 2024 at 2:30 PM local time
 */
export function createDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Month is 0-indexed in Date constructor
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Get today's date as YYYY-MM-DD string in LOCAL timezone
 *
 * @returns Today's date in YYYY-MM-DD format (local timezone)
 *
 * @example
 * // Server in UTC+8 on Dec 24, 2024 at 2:00 AM
 * getTodayLocal(); // "2024-12-24"
 * // NOT "2024-12-23" (which toISOString would give)
 */
export function getTodayLocal(): string {
  return formatLocalDate(new Date());
}

/**
 * Add days to a date in local timezone
 *
 * @param date - Starting date
 * @param days - Number of days to add (can be negative)
 * @returns New Date object with days added
 *
 * @example
 * const date = new Date(2024, 11, 24); // Dec 24, 2024
 * addDays(date, 7); // Dec 31, 2024
 * addDays(date, -1); // Dec 23, 2024
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format a time string in 24-hour format (HH:MM) as 12-hour with AM/PM
 *
 * @param time - Time string in HH:MM format (24-hour)
 * @returns Time string in 12-hour format with AM/PM
 *
 * @example
 * formatTime12Hour("09:30"); // "9:30 AM"
 * formatTime12Hour("13:45"); // "1:45 PM"
 * formatTime12Hour("00:00"); // "12:00 AM"
 * formatTime12Hour("12:00"); // "12:00 PM"
 */
export function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);

  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Parse a time string in HH:MM format to hours and minutes
 *
 * @param timeStr - Time string in HH:MM format
 * @returns Object with hours and minutes as numbers
 *
 * @example
 * parseTime("14:30"); // { hours: 14, minutes: 30 }
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Get the start of day (midnight) for a given date
 *
 * @param date - Date object
 * @returns New Date object at midnight (00:00:00) local time
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of day (23:59:59.999) for a given date
 *
 * @param date - Date object
 * @returns New Date object at end of day (23:59:59.999) local time
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Check if two dates are on the same day (ignoring time)
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if both dates are on the same calendar day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Calculate the difference in days between two dates
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days difference (can be negative)
 */
export function daysDifference(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = startOfDay(date1);
  const end = startOfDay(date2);

  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Format a Date object to ISO string but preserve local date
 *
 * This creates an ISO-like timestamp but maintains the local date.
 * Useful for database storage when you want timestamp precision
 * but need to preserve the user's calendar date.
 *
 * @param date - Date object
 * @returns ISO-like timestamp string with local timezone
 *
 * @example
 * // Server in UTC+8 on Dec 24, 2024 at 2:30 PM
 * const date = new Date(2024, 11, 24, 14, 30);
 * toLocalISOString(date); // "2024-12-24T14:30:00.000+08:00"
 */
export function toLocalISOString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');

  // Get timezone offset in minutes
  const tzOffset = -date.getTimezoneOffset();
  const tzHours = Math.floor(Math.abs(tzOffset) / 60);
  const tzMinutes = Math.abs(tzOffset) % 60;
  const tzSign = tzOffset >= 0 ? '+' : '-';
  const tzString = `${tzSign}${String(tzHours).padStart(2, '0')}:${String(tzMinutes).padStart(2, '0')}`;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${tzString}`;
}
