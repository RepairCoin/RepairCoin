// frontend/src/services/api/appointments.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ==================== TYPES ====================

export interface TimeSlot {
  time: string; // HH:MM format
  available: boolean;
  bookedCount: number;
  maxBookings: number;
}

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

// ==================== API CLIENT ====================

export const appointmentsApi = {
  // Public: Get available time slots for a service
  async getAvailableTimeSlots(
    shopId: string,
    serviceId: string,
    date: string
  ): Promise<TimeSlot[]> {
    const response = await axios.get<{ success: boolean; data: TimeSlot[] }>(
      `${API_URL}/services/appointments/available-slots`,
      {
        params: { shopId, serviceId, date }
      }
    );
    return response.data.data;
  },

  // Public: Get shop availability (operating hours)
  async getShopAvailability(shopId: string): Promise<ShopAvailability[]> {
    const response = await axios.get<{ success: boolean; data: ShopAvailability[] }>(
      `${API_URL}/services/appointments/shop-availability/${shopId}`
    );
    return response.data.data;
  },

  // Shop: Update shop availability
  async updateShopAvailability(availability: {
    dayOfWeek: number;
    isOpen: boolean;
    openTime?: string;
    closeTime?: string;
    breakStartTime?: string;
    breakEndTime?: string;
  }): Promise<ShopAvailability> {
    const response = await axios.put<{ success: boolean; data: ShopAvailability }>(
      `${API_URL}/services/appointments/shop-availability`,
      availability,
      { withCredentials: true }
    );
    return response.data.data;
  },

  // Shop: Get time slot configuration
  async getTimeSlotConfig(): Promise<TimeSlotConfig | null> {
    const response = await axios.get<{ success: boolean; data: TimeSlotConfig | null }>(
      `${API_URL}/services/appointments/time-slot-config`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  // Shop: Update time slot configuration
  async updateTimeSlotConfig(config: Partial<TimeSlotConfig>): Promise<TimeSlotConfig> {
    const response = await axios.put<{ success: boolean; data: TimeSlotConfig }>(
      `${API_URL}/services/appointments/time-slot-config`,
      config,
      { withCredentials: true }
    );
    return response.data.data;
  },

  // Shop: Get date overrides
  async getDateOverrides(startDate?: string, endDate?: string): Promise<DateOverride[]> {
    const response = await axios.get<{ success: boolean; data: DateOverride[] }>(
      `${API_URL}/services/appointments/date-overrides`,
      {
        params: { startDate, endDate },
        withCredentials: true
      }
    );
    return response.data.data;
  },

  // Shop: Create date override
  async createDateOverride(override: {
    overrideDate: string;
    isClosed?: boolean;
    customOpenTime?: string;
    customCloseTime?: string;
    reason?: string;
  }): Promise<DateOverride> {
    const response = await axios.post<{ success: boolean; data: DateOverride }>(
      `${API_URL}/services/appointments/date-overrides`,
      override,
      { withCredentials: true }
    );
    return response.data.data;
  },

  // Shop: Delete date override
  async deleteDateOverride(date: string): Promise<void> {
    await axios.delete(
      `${API_URL}/services/appointments/date-overrides/${date}`,
      { withCredentials: true }
    );
  },

  // Shop: Get calendar view
  async getShopCalendar(startDate: string, endDate: string): Promise<CalendarBooking[]> {
    const response = await axios.get<{ success: boolean; data: CalendarBooking[] }>(
      `${API_URL}/services/appointments/calendar`,
      {
        params: { startDate, endDate },
        withCredentials: true
      }
    );
    return response.data.data;
  },

  // Shop: Update service duration
  async updateServiceDuration(serviceId: string, durationMinutes: number): Promise<void> {
    await axios.put(
      `${API_URL}/services/${serviceId}/duration`,
      { durationMinutes },
      { withCredentials: true }
    );
  }
};
