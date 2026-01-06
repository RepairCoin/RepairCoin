/**
 * Timezone utility functions for handling shop-specific time calculations
 *
 * These functions ensure that time slot availability is calculated correctly
 * regardless of what timezone the server is running in.
 */

/**
 * Get the current time in a specific timezone
 *
 * @param timezone - IANA timezone identifier (e.g., 'America/New_York')
 * @returns Object with hours, minutes, and full date in the target timezone
 */
export function getCurrentTimeInTimezone(timezone: string): {
  hours: number;
  minutes: number;
  date: Date;
  dateString: string;
  timeString: string;
} {
  const now = new Date();

  // Format the current time in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

  const year = parseInt(getPart('year'));
  const month = parseInt(getPart('month'));
  const day = parseInt(getPart('day'));
  const hours = parseInt(getPart('hour'));
  const minutes = parseInt(getPart('minute'));

  // Create a date string in YYYY-MM-DD format
  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return {
    hours,
    minutes,
    date: now,
    dateString,
    timeString
  };
}

/**
 * Create a Date object representing a specific date and time in a timezone
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timeStr - Time string in HH:MM format
 * @param timezone - IANA timezone identifier
 * @returns Date object (in UTC, but representing the specified local time)
 */
export function createDateTimeInTimezone(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  // Parse the date and time components
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Create a date string that JavaScript can parse with timezone
  // Format: "YYYY-MM-DDTHH:MM:SS" then use timezone to interpret
  const isoString = `${dateStr}T${timeStr}:00`;

  // Create date in the target timezone by using Intl to find the offset
  const targetDate = new Date(isoString);

  // Get the offset between UTC and the target timezone at this date
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  // Use Intl to format in target timezone and parse back
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Calculate the offset by comparing what we want vs what UTC gives us
  // This is a workaround since JS doesn't have native timezone support
  const parts = formatter.formatToParts(utcDate);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');

  const tzHours = getPart('hour');
  const tzMinutes = getPart('minute');
  const tzDay = getPart('day');

  // Calculate offset in minutes
  let offsetMinutes = (hours * 60 + minutes) - (tzHours * 60 + tzMinutes);

  // Adjust for day boundary crossing
  if (tzDay !== day) {
    if (tzDay < day) {
      offsetMinutes -= 24 * 60; // Target timezone is behind UTC
    } else {
      offsetMinutes += 24 * 60; // Target timezone is ahead of UTC
    }
  }

  // Create the final date by adding the offset
  return new Date(utcDate.getTime() + offsetMinutes * 60 * 1000);
}

/**
 * Calculate hours until a specific time slot in a shop's timezone
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timeStr - Time string in HH:MM format
 * @param timezone - Shop's IANA timezone identifier
 * @returns Number of hours until the slot (can be negative if in the past)
 */
export function hoursUntilSlotInTimezone(
  dateStr: string,
  timeStr: string,
  timezone: string
): number {
  const now = new Date();
  const currentInTz = getCurrentTimeInTimezone(timezone);

  // Parse target date and time
  const [targetYear, targetMonth, targetDay] = dateStr.split('-').map(Number);
  const [targetHours, targetMinutes] = timeStr.split(':').map(Number);

  // Parse current date and time in timezone
  const [currentYear, currentMonth, currentDay] = currentInTz.dateString.split('-').map(Number);
  const currentHours = currentInTz.hours;
  const currentMinutes = currentInTz.minutes;

  // Calculate total minutes for each
  const targetTotalMinutes =
    ((targetYear - 2000) * 365 * 24 * 60) + // Approximate year contribution
    (targetMonth * 30 * 24 * 60) + // Approximate month contribution
    (targetDay * 24 * 60) +
    (targetHours * 60) +
    targetMinutes;

  const currentTotalMinutes =
    ((currentYear - 2000) * 365 * 24 * 60) +
    (currentMonth * 30 * 24 * 60) +
    (currentDay * 24 * 60) +
    (currentHours * 60) +
    currentMinutes;

  const diffMinutes = targetTotalMinutes - currentTotalMinutes;
  return diffMinutes / 60;
}

/**
 * More accurate calculation using actual date objects
 */
export function hoursUntilSlotAccurate(
  dateStr: string,
  timeStr: string,
  timezone: string
): number {
  // Get current time components in the shop's timezone
  const currentInTz = getCurrentTimeInTimezone(timezone);

  // Parse target slot
  const [targetYear, targetMonth, targetDay] = dateStr.split('-').map(Number);
  const [targetHours, targetMinutes] = timeStr.split(':').map(Number);

  // Parse current time in timezone
  const [currentYear, currentMonth, currentDay] = currentInTz.dateString.split('-').map(Number);

  // Create comparable timestamps (as if both are in the same timezone)
  // We use UTC dates but with the local time values, so the comparison is timezone-neutral
  const targetTimestamp = Date.UTC(targetYear, targetMonth - 1, targetDay, targetHours, targetMinutes, 0);
  const currentTimestamp = Date.UTC(currentYear, currentMonth - 1, currentDay, currentInTz.hours, currentInTz.minutes, 0);

  const diffMs = targetTimestamp - currentTimestamp;
  return diffMs / (1000 * 60 * 60);
}

/**
 * Check if a date string represents today in a specific timezone
 */
export function isDateTodayInTimezone(dateStr: string, timezone: string): boolean {
  const currentInTz = getCurrentTimeInTimezone(timezone);
  return dateStr === currentInTz.dateString;
}

/**
 * Get a list of common US timezones for dropdown selection
 */
export function getCommonTimezones(): { value: string; label: string }[] {
  return [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'America/Phoenix', label: 'Arizona (No DST)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Central European (CET)' },
    { value: 'Asia/Tokyo', label: 'Japan (JST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'UTC', label: 'UTC' }
  ];
}

/**
 * Validate if a timezone string is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (e) {
    return false;
  }
}
