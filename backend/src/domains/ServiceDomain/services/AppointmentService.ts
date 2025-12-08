// backend/src/domains/ServiceDomain/services/AppointmentService.ts
import { AppointmentRepository, TimeSlot } from '../../../repositories/AppointmentRepository';
import { logger } from '../../../utils/logger';

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
      // Get shop configuration
      const config = await this.appointmentRepo.getTimeSlotConfig(shopId);
      if (!config) {
        throw new Error('Shop time slot configuration not found');
      }

      // Get service duration (or use default)
      const serviceDuration = await this.appointmentRepo.getServiceDuration(serviceId);
      const durationMinutes = serviceDuration?.durationMinutes || config.slotDurationMinutes;

      // Parse the date and get day of week
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday

      // Check if weekend booking is allowed
      if ((dayOfWeek === 0 || dayOfWeek === 6) && !config.allowWeekendBooking) {
        return [];
      }

      // Check for date overrides (holidays, closures)
      const overrides = await this.appointmentRepo.getDateOverrides(shopId, date, date);
      const dateOverride = overrides.find(o => o.overrideDate === date);

      if (dateOverride && dateOverride.isClosed) {
        return [];
      }

      // Get shop availability for this day
      const availability = await this.appointmentRepo.getShopAvailability(shopId);
      const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);

      if (!dayAvailability || !dayAvailability.isOpen) {
        return [];
      }

      // Use override times if available, otherwise use regular hours
      const openTime = dateOverride?.customOpenTime || dayAvailability.openTime;
      const closeTime = dateOverride?.customCloseTime || dayAvailability.closeTime;

      if (!openTime || !closeTime) {
        return [];
      }

      // Check if booking is within advance booking window
      const now = new Date();
      const bookingDate = new Date(date);
      const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilBooking < config.minBookingHours) {
        return []; // Too soon to book
      }

      const daysUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilBooking > config.bookingAdvanceDays) {
        return []; // Too far in advance
      }

      // Get already booked slots for this date
      const bookedSlots = await this.appointmentRepo.getBookedSlots(shopId, date);
      const bookedMap = new Map(bookedSlots.map(s => [s.timeSlot, s.count]));

      // Generate time slots
      const slots: TimeSlot[] = [];
      const [openHour, openMin] = openTime.split(':').map(Number);
      const [closeHour, closeMin] = closeTime.split(':').map(Number);

      let currentTime = new Date();
      currentTime.setHours(openHour, openMin, 0, 0);

      const endTime = new Date();
      endTime.setHours(closeHour, closeMin, 0, 0);

      // Generate slots with buffer time
      const totalSlotTime = durationMinutes + config.bufferTimeMinutes;

      while (currentTime < endTime) {
        // Check if slot would end before close time
        const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60000);
        if (slotEnd > endTime) {
          break;
        }

        // Check if slot is during break time
        const timeStr = this.formatTime(currentTime);
        const inBreak = this.isInBreakTime(
          timeStr,
          dayAvailability.breakStartTime,
          dayAvailability.breakEndTime
        );

        if (!inBreak) {
          const bookedCount = bookedMap.get(timeStr) || 0;
          const available = bookedCount < config.maxConcurrentBookings;

          // Check if it's too soon (same day booking)
          const slotDateTime = new Date(date + ' ' + timeStr);
          const hoursUntilSlot = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (hoursUntilSlot >= config.minBookingHours) {
            slots.push({
              time: timeStr,
              available,
              bookedCount,
              maxBookings: config.maxConcurrentBookings
            });
          }
        }

        // Move to next slot
        currentTime = new Date(currentTime.getTime() + totalSlotTime * 60000);
      }

      return slots;
    } catch (error) {
      logger.error('Error getting available time slots:', error);
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
}
