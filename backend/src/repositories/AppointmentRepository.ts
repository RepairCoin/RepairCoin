// backend/src/repositories/AppointmentRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface ShopAvailability {
  availabilityId: string;
  shopId: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  isOpen: boolean;
  openTime: string | null; // HH:MM:SS format
  closeTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlotConfig {
  configId: string;
  shopId: string;
  slotDurationMinutes: number;
  bufferTimeMinutes: number;
  maxConcurrentBookings: number;
  bookingAdvanceDays: number;
  minBookingHours: number;
  allowWeekendBooking: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceDuration {
  durationId: string;
  serviceId: string;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface DateOverride {
  overrideId: string;
  shopId: string;
  overrideDate: string; // YYYY-MM-DD
  isClosed: boolean;
  customOpenTime: string | null;
  customCloseTime: string | null;
  reason: string | null;
  createdAt: string;
}

export interface TimeSlot {
  time: string; // HH:MM format
  available: boolean;
  bookedCount: number;
  maxBookings: number;
}

export interface CalendarBooking {
  orderId: string;
  shopId: string;
  serviceId: string;
  serviceName: string;
  customerAddress: string;
  customerName: string | null;
  bookingDate: string;
  bookingTimeSlot: string | null;
  bookingEndTime: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
}

export class AppointmentRepository extends BaseRepository {
  // ==================== SHOP AVAILABILITY ====================

  async getShopAvailability(shopId: string): Promise<ShopAvailability[]> {
    try {
      const query = `
        SELECT
          availability_id as "availabilityId",
          shop_id as "shopId",
          day_of_week as "dayOfWeek",
          is_open as "isOpen",
          open_time as "openTime",
          close_time as "closeTime",
          break_start_time as "breakStartTime",
          break_end_time as "breakEndTime",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM shop_availability
        WHERE shop_id = $1
        ORDER BY day_of_week
      `;

      const result = await this.pool.query(query, [shopId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting shop availability:', error);
      throw new Error('Failed to get shop availability');
    }
  }

  async updateShopAvailability(availability: Partial<ShopAvailability> & { shopId: string; dayOfWeek: number }): Promise<ShopAvailability> {
    try {
      const query = `
        INSERT INTO shop_availability (
          shop_id, day_of_week, is_open, open_time, close_time, break_start_time, break_end_time
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (shop_id, day_of_week)
        DO UPDATE SET
          is_open = EXCLUDED.is_open,
          open_time = EXCLUDED.open_time,
          close_time = EXCLUDED.close_time,
          break_start_time = EXCLUDED.break_start_time,
          break_end_time = EXCLUDED.break_end_time,
          updated_at = NOW()
        RETURNING
          availability_id as "availabilityId",
          shop_id as "shopId",
          day_of_week as "dayOfWeek",
          is_open as "isOpen",
          open_time as "openTime",
          close_time as "closeTime",
          break_start_time as "breakStartTime",
          break_end_time as "breakEndTime",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const result = await this.pool.query(query, [
        availability.shopId,
        availability.dayOfWeek,
        availability.isOpen ?? true,
        availability.openTime || null,
        availability.closeTime || null,
        availability.breakStartTime || null,
        availability.breakEndTime || null
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating shop availability:', error);
      throw new Error('Failed to update shop availability');
    }
  }

  // ==================== TIME SLOT CONFIG ====================

  async getTimeSlotConfig(shopId: string): Promise<TimeSlotConfig | null> {
    try {
      const query = `
        SELECT
          config_id as "configId",
          shop_id as "shopId",
          slot_duration_minutes as "slotDurationMinutes",
          buffer_time_minutes as "bufferTimeMinutes",
          max_concurrent_bookings as "maxConcurrentBookings",
          booking_advance_days as "bookingAdvanceDays",
          min_booking_hours as "minBookingHours",
          allow_weekend_booking as "allowWeekendBooking",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM shop_time_slot_config
        WHERE shop_id = $1
      `;

      const result = await this.pool.query(query, [shopId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting time slot config:', error);
      throw new Error('Failed to get time slot config');
    }
  }

  async updateTimeSlotConfig(config: Partial<TimeSlotConfig> & { shopId: string }): Promise<TimeSlotConfig> {
    try {
      const query = `
        INSERT INTO shop_time_slot_config (
          shop_id, slot_duration_minutes, buffer_time_minutes, max_concurrent_bookings,
          booking_advance_days, min_booking_hours, allow_weekend_booking
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (shop_id)
        DO UPDATE SET
          slot_duration_minutes = EXCLUDED.slot_duration_minutes,
          buffer_time_minutes = EXCLUDED.buffer_time_minutes,
          max_concurrent_bookings = EXCLUDED.max_concurrent_bookings,
          booking_advance_days = EXCLUDED.booking_advance_days,
          min_booking_hours = EXCLUDED.min_booking_hours,
          allow_weekend_booking = EXCLUDED.allow_weekend_booking,
          updated_at = NOW()
        RETURNING
          config_id as "configId",
          shop_id as "shopId",
          slot_duration_minutes as "slotDurationMinutes",
          buffer_time_minutes as "bufferTimeMinutes",
          max_concurrent_bookings as "maxConcurrentBookings",
          booking_advance_days as "bookingAdvanceDays",
          min_booking_hours as "minBookingHours",
          allow_weekend_booking as "allowWeekendBooking",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const result = await this.pool.query(query, [
        config.shopId,
        config.slotDurationMinutes ?? 60,
        config.bufferTimeMinutes ?? 15,
        config.maxConcurrentBookings ?? 1,
        config.bookingAdvanceDays ?? 30,
        config.minBookingHours ?? 2,
        config.allowWeekendBooking ?? true
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating time slot config:', error);
      throw new Error('Failed to update time slot config');
    }
  }

  // ==================== DATE OVERRIDES ====================

  async getDateOverrides(shopId: string, startDate?: string, endDate?: string): Promise<DateOverride[]> {
    try {
      let query = `
        SELECT
          override_id as "overrideId",
          shop_id as "shopId",
          override_date as "overrideDate",
          is_closed as "isClosed",
          custom_open_time as "customOpenTime",
          custom_close_time as "customCloseTime",
          reason,
          created_at as "createdAt"
        FROM shop_date_overrides
        WHERE shop_id = $1
      `;

      const params: any[] = [shopId];

      if (startDate) {
        query += ` AND override_date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND override_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      query += ` ORDER BY override_date`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting date overrides:', error);
      throw new Error('Failed to get date overrides');
    }
  }

  async createDateOverride(override: Omit<DateOverride, 'overrideId' | 'createdAt'>): Promise<DateOverride> {
    try {
      const query = `
        INSERT INTO shop_date_overrides (
          shop_id, override_date, is_closed, custom_open_time, custom_close_time, reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (shop_id, override_date)
        DO UPDATE SET
          is_closed = EXCLUDED.is_closed,
          custom_open_time = EXCLUDED.custom_open_time,
          custom_close_time = EXCLUDED.custom_close_time,
          reason = EXCLUDED.reason
        RETURNING
          override_id as "overrideId",
          shop_id as "shopId",
          override_date as "overrideDate",
          is_closed as "isClosed",
          custom_open_time as "customOpenTime",
          custom_close_time as "customCloseTime",
          reason,
          created_at as "createdAt"
      `;

      const result = await this.pool.query(query, [
        override.shopId,
        override.overrideDate,
        override.isClosed ?? true,
        override.customOpenTime || null,
        override.customCloseTime || null,
        override.reason || null
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating date override:', error);
      throw new Error('Failed to create date override');
    }
  }

  async deleteDateOverride(shopId: string, overrideDate: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM shop_date_overrides
        WHERE shop_id = $1 AND override_date = $2
      `;

      await this.pool.query(query, [shopId, overrideDate]);
      return true;
    } catch (error) {
      logger.error('Error deleting date override:', error);
      throw new Error('Failed to delete date override');
    }
  }

  // ==================== SERVICE DURATION ====================

  async getServiceDuration(serviceId: string): Promise<ServiceDuration | null> {
    try {
      const query = `
        SELECT
          duration_id as "durationId",
          service_id as "serviceId",
          duration_minutes as "durationMinutes",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM service_duration_config
        WHERE service_id = $1
      `;

      const result = await this.pool.query(query, [serviceId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting service duration:', error);
      throw new Error('Failed to get service duration');
    }
  }

  async updateServiceDuration(serviceId: string, durationMinutes: number): Promise<ServiceDuration> {
    try {
      const query = `
        INSERT INTO service_duration_config (service_id, duration_minutes)
        VALUES ($1, $2)
        ON CONFLICT (service_id)
        DO UPDATE SET
          duration_minutes = EXCLUDED.duration_minutes,
          updated_at = NOW()
        RETURNING
          duration_id as "durationId",
          service_id as "serviceId",
          duration_minutes as "durationMinutes",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const result = await this.pool.query(query, [serviceId, durationMinutes]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating service duration:', error);
      throw new Error('Failed to update service duration');
    }
  }

  // ==================== AVAILABLE TIME SLOTS ====================

  async getBookedSlots(shopId: string, date: string): Promise<{ timeSlot: string; count: number }[]> {
    try {
      const query = `
        SELECT
          booking_time_slot as "timeSlot",
          COUNT(*) as count
        FROM service_orders
        WHERE shop_id = $1
          AND booking_date = $2
          AND booking_time_slot IS NOT NULL
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY booking_time_slot
        ORDER BY booking_time_slot
      `;

      const result = await this.pool.query(query, [shopId, date]);
      return result.rows.map(row => ({
        timeSlot: row.timeSlot,
        count: parseInt(row.count)
      }));
    } catch (error) {
      logger.error('Error getting booked slots:', error);
      throw new Error('Failed to get booked slots');
    }
  }

  // ==================== SHOP CALENDAR ====================

  async getShopCalendar(shopId: string, startDate: string, endDate: string): Promise<CalendarBooking[]> {
    try {
      const query = `
        SELECT
          order_id as "orderId",
          shop_id as "shopId",
          service_id as "serviceId",
          service_name as "serviceName",
          customer_address as "customerAddress",
          customer_name as "customerName",
          booking_date as "bookingDate",
          booking_time_slot as "bookingTimeSlot",
          booking_end_time as "bookingEndTime",
          status,
          total_amount as "totalAmount",
          notes,
          created_at as "createdAt"
        FROM shop_calendar_view
        WHERE shop_id = $1
          AND booking_date >= $2
          AND booking_date <= $3
        ORDER BY booking_date, booking_time_slot
      `;

      const result = await this.pool.query(query, [shopId, startDate, endDate]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting shop calendar:', error);
      throw new Error('Failed to get shop calendar');
    }
  }
}
