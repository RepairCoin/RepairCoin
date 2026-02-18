import { apiClient } from "@/shared/utilities/axios";
import { buildQueryString } from "@/shared/utilities/buildQueryString";
import {
  TimeSlot,
  ShopAvailability,
  TimeSlotConfig,
  CalendarBooking,
} from "@/shared/interfaces/appointment.interface";

// ============================================
// Types
// ============================================

export type RescheduleRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export interface RescheduleRequest {
  requestId: string;
  orderId: string;
  shopId: string;
  customerAddress: string;
  customerName?: string;
  originalDate: string;
  originalTimeSlot: string;
  originalEndTime?: string;
  requestedDate: string;
  requestedTimeSlot: string;
  requestedEndTime?: string;
  status: RescheduleRequestStatus;
  customerReason?: string;
  shopReason?: string;
  createdAt: string;
  expiresAt?: string;
  // Order details (populated)
  serviceName?: string;
  serviceId?: string;
  totalAmount?: number;
}

export interface CustomerSearchResult {
  customerAddress: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  totalBookings?: number;
  lastVisit?: string;
}

export interface ManualBookingData {
  customerAddress: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  serviceId: string;
  bookingDate: string; // YYYY-MM-DD
  bookingTimeSlot: string; // HH:MM:SS
  bookingEndTime: string; // HH:MM:SS
  paymentStatus: "paid" | "pending" | "unpaid";
  notes?: string;
  createNewCustomer?: boolean;
}

export interface ManualBookingResponse {
  success: boolean;
  data: {
    orderId: string;
    status: string;
    bookingDate: string;
    bookingTimeSlot: string;
  };
  message: string;
}

// ============================================
// Appointment API Class
// ============================================

class AppointmentApi {
  // ============================================
  // Time Slots & Availability
  // ============================================

  /**
   * Get available time slots for a service on a specific date
   */
  async getAvailableTimeSlots(
    shopId: string,
    serviceId: string,
    date: string
  ): Promise<TimeSlot[]> {
    try {
      const queryString = buildQueryString({ shopId, serviceId, date });
      const response = await apiClient.get(
        `/services/appointments/available-slots${queryString}`
      );
      return response.data || [];
    } catch (error: any) {
      console.error("Failed to get available time slots:", error.message);
      throw error;
    }
  }

  /**
   * Get shop operating hours by day of week
   */
  async getShopAvailability(shopId: string): Promise<ShopAvailability[]> {
    try {
      const response = await apiClient.get(
        `/services/appointments/shop-availability/${shopId}`
      );
      return response.data || [];
    } catch (error: any) {
      console.error("Failed to get shop availability:", error.message);
      throw error;
    }
  }

  /**
   * Get shop's time slot configuration
   */
  async getTimeSlotConfig(shopId: string): Promise<TimeSlotConfig | null> {
    try {
      const response = await apiClient.get(
        `/services/appointments/time-slot-config/${shopId}`
      );
      return response.data || null;
    } catch (error: any) {
      console.error("Failed to get time slot config:", error.message);
      throw error;
    }
  }

  /**
   * Get shop calendar bookings
   */
  async getShopCalendar(
    startDate: string,
    endDate: string
  ): Promise<CalendarBooking[]> {
    try {
      const queryString = buildQueryString({ startDate, endDate });
      const response = await apiClient.get(
        `/services/appointments/calendar${queryString}`
      );
      return response.data || [];
    } catch (error: any) {
      console.error("Failed to get shop calendar:", error.message);
      throw error;
    }
  }

  // ============================================
  // No-Show Management
  // ============================================

  /**
   * Mark an order as no-show (Shop only)
   */
  async markOrderAsNoShow(orderId: string, notes?: string): Promise<boolean> {
    try {
      await apiClient.post(`/services/orders/${orderId}/mark-no-show`, {
        notes,
      });
      return true;
    } catch (error: any) {
      console.error("Failed to mark order as no-show:", error.message);
      throw error;
    }
  }

  // ============================================
  // Shop Direct Reschedule
  // ============================================

  /**
   * Shop directly reschedules an appointment (no customer approval needed)
   */
  async directRescheduleOrder(
    orderId: string,
    newDate: string,
    newTimeSlot: string,
    reason?: string
  ): Promise<boolean> {
    try {
      await apiClient.post(`/services/bookings/${orderId}/direct-reschedule`, {
        newDate,
        newTimeSlot,
        reason,
      });
      return true;
    } catch (error: any) {
      console.error("Failed to reschedule order:", error.message);
      throw error;
    }
  }

  // ============================================
  // Reschedule Requests (Shop Management)
  // ============================================

  /**
   * Get all reschedule requests for shop
   */
  async getShopRescheduleRequests(
    status?: RescheduleRequestStatus | "all"
  ): Promise<RescheduleRequest[]> {
    try {
      const queryString = status ? buildQueryString({ status }) : "";
      const response = await apiClient.get(
        `/services/appointments/reschedule-requests${queryString}`
      );
      return response.data || [];
    } catch (error: any) {
      console.error("Failed to get reschedule requests:", error.message);
      throw error;
    }
  }

  /**
   * Get count of pending reschedule requests (for badge)
   */
  async getShopRescheduleRequestCount(): Promise<number> {
    try {
      const response = await apiClient.get(
        `/services/appointments/reschedule-requests/count`
      );
      return response.data?.count || response.count || 0;
    } catch (error: any) {
      console.error("Failed to get reschedule request count:", error.message);
      return 0;
    }
  }

  /**
   * Approve a customer's reschedule request
   */
  async approveRescheduleRequest(requestId: string): Promise<boolean> {
    try {
      await apiClient.post(
        `/services/appointments/reschedule-request/${requestId}/approve`
      );
      return true;
    } catch (error: any) {
      console.error("Failed to approve reschedule request:", error.message);
      throw error;
    }
  }

  /**
   * Reject a customer's reschedule request
   */
  async rejectRescheduleRequest(
    requestId: string,
    reason?: string
  ): Promise<boolean> {
    try {
      await apiClient.post(
        `/services/appointments/reschedule-request/${requestId}/reject`,
        { reason }
      );
      return true;
    } catch (error: any) {
      console.error("Failed to reject reschedule request:", error.message);
      throw error;
    }
  }

  // ============================================
  // Manual Booking (Walk-in/Phone)
  // ============================================

  /**
   * Search customers for manual booking
   */
  async searchCustomers(
    shopId: string,
    query: string
  ): Promise<CustomerSearchResult[]> {
    try {
      const queryString = buildQueryString({ q: query });
      const response = await apiClient.get(
        `/services/shops/${shopId}/customers/search${queryString}`
      );
      return response.data || [];
    } catch (error: any) {
      console.error("Failed to search customers:", error.message);
      throw error;
    }
  }

  /**
   * Create a manual booking (walk-in, phone booking)
   */
  async createManualBooking(
    shopId: string,
    bookingData: ManualBookingData
  ): Promise<ManualBookingResponse> {
    try {
      const response = await apiClient.post(
        `/services/shops/${shopId}/appointments/manual`,
        bookingData
      );
      return {
        success: true,
        data: response.data,
        message: response.message || "Booking created successfully",
      };
    } catch (error: any) {
      console.error("Failed to create manual booking:", error.message);
      throw error;
    }
  }
}

export const appointmentApi = new AppointmentApi();
