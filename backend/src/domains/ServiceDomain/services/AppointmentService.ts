// backend/src/domains/ServiceDomain/services/AppointmentService.ts
import { AppointmentRepository, TimeSlot } from '../../../repositories/AppointmentRepository';
import { logger } from '../../../utils/logger';
import { parseLocalDateString, createDateTime } from '../../../utils/dateUtils';
import { getCurrentTimeInTimezone, hoursUntilSlotAccurate } from '../../../utils/timezoneUtils';

export class AppointmentService {
  private appointmentRepo: AppointmentRepository;

  constructor() {
    this.appointmentRepo = new AppointmentRepository();
  }

  /**
   * Generate available time slots for a specific shop, service, and date
   */
  async getAvailableTimeSlots(
    shopId: string,
    serviceId: string,
    date: string
  ): Promise<TimeSlot[]> {
    try {
      logger.info('getAvailableTimeSlots called', { shopId, serviceId, date });

      // Get shop configuration
      const config = await this.appointmentRepo.getTimeSlotConfig(shopId);
      if (!config) {
        logger.warn('No time slot config found for shop', { shopId });
        throw new Error('Shop time slot configuration not found');
      }

      // Get shop's timezone (default to America/New_York if not set)
      const shopTimezone = config.timezone || 'America/New_York';

      logger.debug('Time slot config loaded', {
        shopId,
        allowWeekendBooking: config.allowWeekendBooking,
        minBookingHours: config.minBookingHours,
        bookingAdvanceDays: config.bookingAdvanceDays,
        timezone: shopTimezone
      });

      // Get service duration (or use default)
      const serviceDuration = await this.appointmentRepo.getServiceDuration(serviceId);
      const durationMinutes = serviceDuration?.durationMinutes || config.slotDurationMinutes;

      // Parse the date and get day of week
      const targetDate = parseLocalDateString(date);
      const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday

      logger.debug('Date parsed', {
        date,
        parsedDate: targetDate.toISOString(),
        dayOfWeek,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
      });

      // Check if weekend booking is allowed
      if ((dayOfWeek === 0 || dayOfWeek === 6) && !config.allowWeekendBooking) {
        logger.info('Weekend booking not allowed', { dayOfWeek, allowWeekendBooking: config.allowWeekendBooking });
        return [];
      }

      // Check for date overrides (holidays, closures)
      const overrides = await this.appointmentRepo.getDateOverrides(shopId, date, date);
      const dateOverride = overrides.find(o => o.overrideDate === date);

      if (dateOverride && dateOverride.isClosed) {
        logger.info('Date has closure override', { date, reason: dateOverride.reason });
        return [];
      }

      // Get shop availability for this day
      const availability = await this.appointmentRepo.getShopAvailability(shopId);

      logger.debug('Shop availability loaded', {
        shopId,
        totalDays: availability.length,
        availableDays: availability.map(a => ({
          day: a.dayOfWeek,
          dayType: typeof a.dayOfWeek,
          isOpen: a.isOpen,
          openTime: a.openTime,
          closeTime: a.closeTime
        }))
      });

      // CRITICAL FIX: Ensure numeric comparison for dayOfWeek
      // Database may return dayOfWeek as string in some cases
      const dayAvailability = availability.find(a => Number(a.dayOfWeek) === dayOfWeek);

      if (!dayAvailability) {
        logger.warn('No availability entry found for day', {
          shopId,
          date,
          dayOfWeek,
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
          existingDays: availability.map(a => Number(a.dayOfWeek))
        });
        return [];
      }

      if (!dayAvailability.isOpen) {
        logger.info('Day is configured as closed', { dayOfWeek, isOpen: dayAvailability.isOpen });
        return [];
      }

      // Use override times if available, otherwise use regular hours
      const openTime = dateOverride?.customOpenTime || dayAvailability.openTime;
      const closeTime = dateOverride?.customCloseTime || dayAvailability.closeTime;

      if (!openTime || !closeTime) {
        logger.warn('Missing open/close time for day', {
          dayOfWeek,
          openTime,
          closeTime,
          dayAvailability
        });
        return [];
      }

      // Check if booking is within advance booking window
      // IMPORTANT: Use shop's timezone for all time comparisons
      const nowInShopTz = getCurrentTimeInTimezone(shopTimezone);

      logger.debug('Current time in shop timezone', {
        shopTimezone,
        currentDate: nowInShopTz.dateString,
        currentTime: nowInShopTz.timeString,
        requestedDate: date
      });

      // For same-day or next-day bookings, we need more nuanced checking
      // Only reject if the entire day is too soon (date + last slot time < minBookingHours)
      const [closeHour, closeMin] = closeTime.split(':').map(Number);
      const closeTimeStr = `${String(closeHour).padStart(2, '0')}:${String(closeMin).padStart(2, '0')}`;

      // Calculate hours until the last possible slot using shop's timezone
      const hoursUntilLastSlot = hoursUntilSlotAccurate(date, closeTimeStr, shopTimezone);

      // Only reject the entire day if even the last slot is too soon
      if (hoursUntilLastSlot < config.minBookingHours) {
        logger.info('All slots too soon to book', {
          date,
          hoursUntilLastSlot,
          minBookingHours: config.minBookingHours,
          shopTimezone,
          currentTimeInShop: nowInShopTz.timeString
        });
        return [];
      }

      // Check if date is too far in advance
      const [reqYear, reqMonth, reqDay] = date.split('-').map(Number);
      const [curYear, curMonth, curDay] = nowInShopTz.dateString.split('-').map(Number);
      const reqDateNum = reqYear * 10000 + reqMonth * 100 + reqDay;
      const curDateNum = curYear * 10000 + curMonth * 100 + curDay;
      const daysUntilBooking = Math.floor((reqDateNum - curDateNum) / 1); // Approximate

      // More accurate calculation using timestamps
      const reqTimestamp = Date.UTC(reqYear, reqMonth - 1, reqDay);
      const curTimestamp = Date.UTC(curYear, curMonth - 1, curDay);
      const actualDaysUntil = (reqTimestamp - curTimestamp) / (1000 * 60 * 60 * 24);

      if (actualDaysUntil > config.bookingAdvanceDays) {
        logger.info('Date too far in advance', {
          date,
          daysUntilBooking: actualDaysUntil,
          bookingAdvanceDays: config.bookingAdvanceDays,
          shopTimezone
        });
        return [];
      }

      // Get already booked slots for this date
      const bookedSlots = await this.appointmentRepo.getBookedSlots(shopId, date);

      logger.info('DEBUG: Raw booked slots from database', {
        shopId,
        date,
        bookedSlots: bookedSlots.map(s => ({
          rawTimeSlot: s.timeSlot,
          normalizedTimeSlot: this.normalizeTimeSlot(s.timeSlot),
          count: s.count
        }))
      });

      // Normalize time format: PostgreSQL returns "09:00:00" but we use "09:00"
      const bookedMap = new Map(bookedSlots.map(s => [this.normalizeTimeSlot(s.timeSlot), s.count]));

      logger.info('DEBUG: Booked map entries', {
        shopId,
        date,
        mapEntries: Array.from(bookedMap.entries()),
        maxConcurrentBookings: config.maxConcurrentBookings
      });

      // Generate time slots
      const slots: TimeSlot[] = [];
      const [openHour, openMin] = openTime.split(':').map(Number);

      // Re-parse closeTime for slot generation (already parsed above for advance booking check)
      const [closeHourParsed, closeMinParsed] = closeTime.split(':').map(Number);

      // Create times using the booking date, not current date
      const [year, month, day] = date.split('-').map(Number);
      let currentTime = new Date(year, month - 1, day, openHour, openMin, 0, 0);
      let endTime = new Date(year, month - 1, day, closeHourParsed, closeMinParsed, 0, 0);

      // CRITICAL FIX: Handle overnight hours (e.g., 3pm - 12am where close < open)
      // If close time is midnight (00:00) or if close time is before open time,
      // the shop operates overnight, so endTime should be the next day
      const openMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHourParsed * 60 + closeMinParsed;
      if (closeMinutes <= openMinutes) {
        // Overnight hours: add 1 day to endTime
        endTime = new Date(year, month - 1, day + 1, closeHourParsed, closeMinParsed, 0, 0);
        logger.debug('Overnight hours detected', {
          openTime,
          closeTime,
          openMinutes,
          closeMinutes,
          adjustedEndTime: endTime.toISOString()
        });
      }

      logger.debug('Generating slots', {
        date,
        openTime,
        closeTime,
        startTime: currentTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes,
        bufferTimeMinutes: config.bufferTimeMinutes
      });

      // Generate slots with buffer time
      const totalSlotTime = durationMinutes + config.bufferTimeMinutes;
      let slotsSkippedBreak = 0;
      let slotsSkippedTooSoon = 0;
      let slotsSkippedPastClose = 0;

      while (currentTime < endTime) {
        // Check if slot would end before close time
        const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60000);
        if (slotEnd > endTime) {
          slotsSkippedPastClose++;
          break;
        }

        // Check if slot is during break time
        const timeStr = this.formatTime(currentTime);
        const inBreak = this.isInBreakTime(
          timeStr,
          dayAvailability.breakStartTime,
          dayAvailability.breakEndTime
        );

        if (inBreak) {
          slotsSkippedBreak++;
        } else {
          const bookedCount = bookedMap.get(timeStr) || 0;
          const available = bookedCount < config.maxConcurrentBookings;

          // DEBUG: Log each slot's availability calculation
          if (bookedCount > 0) {
            logger.info('DEBUG: Slot has bookings', {
              timeStr,
              bookedCount,
              maxConcurrent: config.maxConcurrentBookings,
              available,
              mapHasKey: bookedMap.has(timeStr)
            });
          }

          // Check if it's too soon (same day booking) using shop's timezone
          const hoursUntilSlot = hoursUntilSlotAccurate(date, timeStr, shopTimezone);

          if (hoursUntilSlot >= config.minBookingHours) {
            slots.push({
              time: timeStr,
              available,
              bookedCount,
              maxBookings: config.maxConcurrentBookings
            });
          } else {
            slotsSkippedTooSoon++;
            // Debug logging for skipped slots
            if (slotsSkippedTooSoon <= 3) {
              logger.debug('Slot skipped (too soon)', {
                timeStr,
                hoursUntilSlot: hoursUntilSlot.toFixed(2),
                minBookingHours: config.minBookingHours,
                shopTimezone,
                currentTimeInShop: nowInShopTz.timeString
              });
            }
          }
        }

        // Move to next slot
        currentTime = new Date(currentTime.getTime() + totalSlotTime * 60000);
      }

      logger.info('Time slots generated', {
        shopId,
        date,
        dayOfWeek,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        totalSlots: slots.length,
        availableSlots: slots.filter(s => s.available).length,
        slotsSkippedBreak,
        slotsSkippedTooSoon,
        slotsSkippedPastClose,
        shopTimezone,
        currentTimeInShop: nowInShopTz.timeString
      });

      return slots;
    } catch (error) {
      logger.error('Error getting available time slots:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        shopId,
        serviceId,
        date
      });
      throw error;
    }
  }

  /**
   * Validate if a time slot can be booked
   */
  async validateTimeSlot(
    shopId: string,
    serviceId: string,
    date: string,
    timeSlot: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const availableSlots = await this.getAvailableTimeSlots(shopId, serviceId, date);

      const slot = availableSlots.find(s => s.time === timeSlot);
      if (!slot) {
        return { valid: false, error: 'Time slot not available' };
      }

      if (!slot.available) {
        return { valid: false, error: 'Time slot is fully booked' };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Error validating time slot:', error);
      return { valid: false, error: 'Failed to validate time slot' };
    }
  }

  /**
   * Calculate end time for a booking
   */
  async calculateEndTime(
    serviceId: string,
    startTime: string,
    shopId: string
  ): Promise<string> {
    try {
      // Get service duration
      const serviceDuration = await this.appointmentRepo.getServiceDuration(serviceId);
      const config = await this.appointmentRepo.getTimeSlotConfig(shopId);

      const durationMinutes = serviceDuration?.durationMinutes || config?.slotDurationMinutes || 60;

      // Parse start time
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);

      // Add duration
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      return this.formatTime(endDate);
    } catch (error) {
      logger.error('Error calculating end time:', error);
      throw error;
    }
  }

  /**
   * Helper: Format time as HH:MM
   */
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Helper: Check if time is within break period
   */
  private isInBreakTime(
    time: string,
    breakStart: string | null,
    breakEnd: string | null
  ): boolean {
    if (!breakStart || !breakEnd) return false;

    const timeMinutes = this.timeToMinutes(time);
    const breakStartMinutes = this.timeToMinutes(breakStart);
    const breakEndMinutes = this.timeToMinutes(breakEnd);

    return timeMinutes >= breakStartMinutes && timeMinutes < breakEndMinutes;
  }

  /**
   * Helper: Convert HH:MM to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Helper: Normalize time string to HH:MM format
   * PostgreSQL TIME returns "HH:MM:SS" but we use "HH:MM" internally
   */
  private normalizeTimeSlot(time: string): string {
    const parts = time.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
}
