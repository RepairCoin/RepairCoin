// frontend/src/services/api/appointments.ts
import apiClient from './client';

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

export interface ServiceDuration {
  durationId: string;
  serviceId: string;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

// Reschedule Types
export interface RescheduleRequest {
  requestId: string;
  orderId: string;
  shopId: string;
  customerAddress: string;
  originalDate: string;
  originalTimeSlot: string;
  originalEndTime: string | null;
  requestedDate: string;
  requestedTimeSlot: string;
  requestedEndTime: string | null;
  customerReason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  shopResponseReason: string | null;
  respondedAt: string | null;
  respondedBy: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface RescheduleRequestWithDetails extends RescheduleRequest {
  customerName: string | null;
  customerEmail: string | null;
  serviceName: string;
  serviceId: string;
  hoursUntilExpiry: number | null;
}

export interface ReschedulePolicy {
  allowReschedule: boolean;
  maxReschedulesPerOrder: number;
  rescheduleMinHours: number;
  rescheduleExpirationHours: number;
  autoApproveReschedule: boolean;
  requireRescheduleReason: boolean;
}

// ==================== API CLIENT ====================

// Note: apiClient already returns response.data and has withCredentials: true configured
// The response interceptor extracts the data, so we access .data directly from the result

export const appointmentsApi = {
  // Public: Get available time slots for a service
  async getAvailableTimeSlots(
    shopId: string,
    serviceId: string,
    date: string
  ): Promise<TimeSlot[]> {
    const response = await apiClient.get<{ success: boolean; data: TimeSlot[] }>(
      `/services/appointments/available-slots`,
      {
        params: { shopId, serviceId, date }
      }
    );
    return (response as unknown as { success: boolean; data: TimeSlot[] }).data;
  },

  // Public: Get shop availability (operating hours)
  async getShopAvailability(shopId: string): Promise<ShopAvailability[]> {
    const response = await apiClient.get<{ success: boolean; data: ShopAvailability[] }>(
      `/services/appointments/shop-availability/${shopId}`
    );
    return (response as unknown as { success: boolean; data: ShopAvailability[] }).data;
  },

  // Public: Get time slot configuration by shop ID (for customers)
  async getPublicTimeSlotConfig(shopId: string): Promise<TimeSlotConfig | null> {
    const response = await apiClient.get<{ success: boolean; data: TimeSlotConfig | null }>(
      `/services/appointments/time-slot-config/${shopId}`
    );
    return (response as unknown as { success: boolean; data: TimeSlotConfig | null }).data;
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
    const response = await apiClient.put<{ success: boolean; data: ShopAvailability }>(
      `/services/appointments/shop-availability`,
      availability
    );
    return (response as unknown as { success: boolean; data: ShopAvailability }).data;
  },

  // Shop: Get time slot configuration
  async getTimeSlotConfig(): Promise<TimeSlotConfig | null> {
    const response = await apiClient.get<{ success: boolean; data: TimeSlotConfig | null }>(
      `/services/appointments/time-slot-config`
    );
    return (response as unknown as { success: boolean; data: TimeSlotConfig | null }).data;
  },

  // Shop: Update time slot configuration
  async updateTimeSlotConfig(config: Partial<TimeSlotConfig>): Promise<TimeSlotConfig> {
    const response = await apiClient.put<{ success: boolean; data: TimeSlotConfig }>(
      `/services/appointments/time-slot-config`,
      config
    );
    return (response as unknown as { success: boolean; data: TimeSlotConfig }).data;
  },

  // Shop: Get date overrides
  async getDateOverrides(startDate?: string, endDate?: string): Promise<DateOverride[]> {
    const response = await apiClient.get<{ success: boolean; data: DateOverride[] }>(
      `/services/appointments/date-overrides`,
      {
        params: { startDate, endDate }
      }
    );
    return (response as unknown as { success: boolean; data: DateOverride[] }).data;
  },

  // Shop: Create date override
  async createDateOverride(override: {
    overrideDate: string;
    isClosed?: boolean;
    customOpenTime?: string;
    customCloseTime?: string;
    reason?: string;
  }): Promise<DateOverride> {
    const response = await apiClient.post<{ success: boolean; data: DateOverride }>(
      `/services/appointments/date-overrides`,
      override
    );
    return (response as unknown as { success: boolean; data: DateOverride }).data;
  },

  // Shop: Delete date override
  async deleteDateOverride(date: string): Promise<void> {
    await apiClient.delete(`/services/appointments/date-overrides/${date}`);
  },

  // Shop: Get calendar view
  async getShopCalendar(startDate: string, endDate: string): Promise<CalendarBooking[]> {
    const response = await apiClient.get<{ success: boolean; data: CalendarBooking[] }>(
      `/services/appointments/calendar`,
      {
        params: { startDate, endDate }
      }
    );
    return (response as unknown as { success: boolean; data: CalendarBooking[] }).data;
  },

  // Shop: Get service duration
  async getServiceDuration(serviceId: string): Promise<ServiceDuration | null> {
    const response = await apiClient.get<{ success: boolean; data: ServiceDuration | null }>(
      `/services/${serviceId}/duration`
    );
    return (response as unknown as { success: boolean; data: ServiceDuration | null }).data;
  },

  // Shop: Update service duration
  async updateServiceDuration(serviceId: string, durationMinutes: number): Promise<ServiceDuration> {
    const response = await apiClient.put<{ success: boolean; data: ServiceDuration }>(
      `/services/${serviceId}/duration`,
      { durationMinutes }
    );
    return (response as unknown as { success: boolean; data: ServiceDuration }).data;
  },

  // Customer: Get customer's appointments
  async getCustomerAppointments(startDate: string, endDate: string): Promise<CalendarBooking[]> {
    const response = await apiClient.get<{ success: boolean; data: CalendarBooking[] }>(
      `/services/appointments/my-appointments`,
      {
        params: { startDate, endDate }
      }
    );
    return (response as unknown as { success: boolean; data: CalendarBooking[] }).data;
  },

  // Customer: Cancel appointment
  async cancelAppointment(orderId: string): Promise<void> {
    await apiClient.post(`/services/appointments/cancel/${orderId}`, {});
  },

  // ==================== RESCHEDULE API ====================

  // Customer: Create reschedule request
  async createRescheduleRequest(
    orderId: string,
    requestedDate: string,
    requestedTimeSlot: string,
    reason?: string
  ): Promise<RescheduleRequest> {
    const response = await apiClient.post<{ success: boolean; data: RescheduleRequest }>(
      `/services/appointments/reschedule-request`,
      { orderId, requestedDate, requestedTimeSlot, reason }
    );
    return (response as unknown as { success: boolean; data: RescheduleRequest }).data;
  },

  // Customer: Cancel reschedule request
  async cancelRescheduleRequest(requestId: string): Promise<RescheduleRequest> {
    const response = await apiClient.delete<{ success: boolean; data: RescheduleRequest }>(
      `/services/appointments/reschedule-request/${requestId}`
    );
    return (response as unknown as { success: boolean; data: RescheduleRequest }).data;
  },

  // Customer: Get pending reschedule request for an order
  async getRescheduleRequestForOrder(orderId: string): Promise<RescheduleRequest | null> {
    const response = await apiClient.get<{ success: boolean; data: { hasPendingRequest: boolean; request: RescheduleRequest | null } }>(
      `/services/appointments/reschedule-request/order/${orderId}`
    );
    const result = response as unknown as { success: boolean; data: { hasPendingRequest: boolean; request: RescheduleRequest | null } };
    return result.data.request;
  },

  // Shop: Get all reschedule requests
  async getShopRescheduleRequests(
    status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'all'
  ): Promise<RescheduleRequestWithDetails[]> {
    const response = await apiClient.get<{ success: boolean; data: { requests: RescheduleRequestWithDetails[]; pendingCount: number } }>(
      `/services/appointments/reschedule-requests`,
      { params: { status } }
    );
    const result = response as unknown as { success: boolean; data: { requests: RescheduleRequestWithDetails[]; pendingCount: number } };
    return result.data.requests;
  },

  // Shop: Get pending reschedule request count
  async getShopRescheduleRequestCount(): Promise<number> {
    const response = await apiClient.get<{ success: boolean; data: { count: number } }>(
      `/services/appointments/reschedule-requests/count`
    );
    return (response as unknown as { success: boolean; data: { count: number } }).data.count;
  },

  // Shop: Approve reschedule request
  async approveRescheduleRequest(requestId: string): Promise<RescheduleRequest> {
    const response = await apiClient.post<{ success: boolean; data: RescheduleRequest }>(
      `/services/appointments/reschedule-request/${requestId}/approve`
    );
    return (response as unknown as { success: boolean; data: RescheduleRequest }).data;
  },

  // Shop: Reject reschedule request
  async rejectRescheduleRequest(requestId: string, reason?: string): Promise<RescheduleRequest> {
    const response = await apiClient.post<{ success: boolean; data: RescheduleRequest }>(
      `/services/appointments/reschedule-request/${requestId}/reject`,
      { reason }
    );
    return (response as unknown as { success: boolean; data: RescheduleRequest }).data;
  }
};
