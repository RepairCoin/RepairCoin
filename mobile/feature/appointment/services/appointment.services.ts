import { apiClient } from "@/shared/utilities/axios";
import { buildQueryString } from "@/shared/utilities/buildQueryString";
import {
  TimeSlotsResponse,
  ShopAvailabilityResponse,
  ShopAvailabilityDetailResponse,
  TimeSlotConfigResponse,
  TimeSlotConfigDetailResponse,
  DateOverridesResponse,
  DateOverrideDetailResponse,
  CalendarBookingsResponse,
  MyAppointmentsResponse,
  UpdateAvailabilityRequest,
  CreateDateOverrideRequest,
  TimeSlotConfig,
} from "@/interfaces/appointment.interface";

class AppointmentApi {
  async getAvailableTimeSlots(
    shopId: string,
    serviceId: string,
    date: string
  ): Promise<TimeSlotsResponse> {
    try {
      const queryString = buildQueryString({ shopId, serviceId, date });
      return await apiClient.get(`/services/appointments/available-slots${queryString}`);
    } catch (error: any) {
      console.error("Failed to get available time slots:", error.message);
      throw error;
    }
  }

  async getShopAvailability(shopId: string): Promise<ShopAvailabilityResponse> {
    try {
      return await apiClient.get(`/services/appointments/shop-availability/${shopId}`);
    } catch (error: any) {
      console.error("Failed to get shop availability:", error.message);
      throw error;
    }
  }

  async updateShopAvailability(
    availability: UpdateAvailabilityRequest
  ): Promise<ShopAvailabilityDetailResponse> {
    try {
      return await apiClient.put(`/services/appointments/shop-availability`, availability);
    } catch (error: any) {
      console.error("Failed to update shop availability:", error.message);
      throw error;
    }
  }

  async getTimeSlotConfig(): Promise<TimeSlotConfigResponse> {
    try {
      return await apiClient.get(`/services/appointments/time-slot-config`);
    } catch (error: any) {
      console.error("Failed to get time slot config:", error.message);
      throw error;
    }
  }

  async updateTimeSlotConfig(
    config: Partial<TimeSlotConfig>
  ): Promise<TimeSlotConfigDetailResponse> {
    try {
      return await apiClient.put(`/services/appointments/time-slot-config`, config);
    } catch (error: any) {
      console.error("Failed to update time slot config:", error.message);
      throw error;
    }
  }

  async getDateOverrides(
    startDate?: string,
    endDate?: string
  ): Promise<DateOverridesResponse> {
    try {
      const queryString = buildQueryString({ startDate, endDate });
      return await apiClient.get(`/services/appointments/date-overrides${queryString}`);
    } catch (error: any) {
      console.error("Failed to get date overrides:", error.message);
      throw error;
    }
  }

  async createDateOverride(
    override: CreateDateOverrideRequest
  ): Promise<DateOverrideDetailResponse> {
    try {
      return await apiClient.post(`/services/appointments/date-overrides`, override);
    } catch (error: any) {
      console.error("Failed to create date override:", error.message);
      throw error;
    }
  }

  async deleteDateOverride(date: string): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.delete(`/services/appointments/date-overrides/${date}`);
    } catch (error: any) {
      console.error("Failed to delete date override:", error.message);
      throw error;
    }
  }

  async getShopCalendar(
    startDate: string,
    endDate: string
  ): Promise<CalendarBookingsResponse> {
    try {
      const queryString = buildQueryString({ startDate, endDate });
      return await apiClient.get(`/services/appointments/calendar${queryString}`);
    } catch (error: any) {
      console.error("Failed to get shop calendar:", error.message);
      throw error;
    }
  }

  async updateServiceDuration(
    serviceId: string,
    durationMinutes: number
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.put(`/services/${serviceId}/duration`, { durationMinutes });
    } catch (error: any) {
      console.error("Failed to update service duration:", error.message);
      throw error;
    }
  }

  async getMyAppointments(startDate: string, endDate: string): Promise<MyAppointmentsResponse> {
    try {
      const queryString = buildQueryString({ startDate, endDate });
      return await apiClient.get(`/services/appointments/my-appointments${queryString}`);
    } catch (error: any) {
      console.error("Failed to get my appointments:", error.message);
      throw error;
    }
  }

  async cancelAppointment(orderId: string): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.post(`/services/appointments/cancel/${orderId}`);
    } catch (error: any) {
      console.error("Failed to cancel appointment:", error.message);
      throw error;
    }
  }
}

export const appointmentApi = new AppointmentApi();
