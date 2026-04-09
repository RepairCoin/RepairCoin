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

export type NoShowTier = 'normal' | 'warning' | 'caution' | 'deposit_required' | 'suspended';

export interface CustomerNoShowStatus {
  customerAddress: string;
  noShowCount: number;
  tier: NoShowTier;
  depositRequired: boolean;
  lastNoShowAt?: string;
  bookingSuspendedUntil?: string;
  successfulAppointmentsSinceTier3: number;
  canBook: boolean;
  requiresDeposit: boolean;
  minimumAdvanceHours: number;
  restrictions: string[];
  isHomeShop?: boolean;
  maxRcnRedemptionPercent?: number;
}

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

  /**
   * Get customer's overall no-show status (dashboard banner)
   */
  async getCustomerNoShowStatus(
    customerAddress: string
  ): Promise<CustomerNoShowStatus | null> {
    try {
      const response = await apiClient.get(
        `/customers/${customerAddress}/overall-no-show-status`
      );
      return response.data || response;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      console.error("Failed to get no-show status:", error.message);
      return null;
    }
  }

  /**
   * Get customer's no-show status for a specific shop
   */
  async getCustomerNoShowStatusForShop(
    customerAddress: string,
    shopId: string
  ): Promise<CustomerNoShowStatus | null> {
    try {
      const response = await apiClient.get(
        `/customers/${customerAddress}/no-show-status`,
        { params: { shopId } }
      );
      return response.data || response;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      console.error("Failed to get shop no-show status:", error.message);
      return null;
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
      const response: any = await apiClient.get(
        `/services/appointments/reschedule-requests${queryString}`
      );
      return response.data || response.requests || response || [];
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
  // Reschedule Requests (Customer)
  // ============================================

  /**
   * Customer requests a reschedule for their booking
   */
  async createRescheduleRequest(
    orderId: string,
    requestedDate: string,
    requestedTimeSlot: string,
    reason?: string
  ): Promise<RescheduleRequest> {
    try {
      const response = await apiClient.post(
        `/services/appointments/reschedule-request`,
        { orderId, requestedDate, requestedTimeSlot, reason }
      );
      return response.data;
    } catch (error: any) {
      console.error("Failed to create reschedule request:", error.message);
      throw error;
    }
  }

  /**
   * Customer cancels their pending reschedule request
   */
  async cancelRescheduleRequest(requestId: string): Promise<boolean> {
    try {
      await apiClient.delete(
        `/services/appointments/reschedule-request/${requestId}`
      );
      return true;
    } catch (error: any) {
      console.error("Failed to cancel reschedule request:", error.message);
      throw error;
    }
  }

  /**
   * Get reschedule request for a specific order (Customer)
   */
  async getRescheduleRequestForOrder(
    orderId: string
  ): Promise<RescheduleRequest | null> {
    try {
      const response = await apiClient.get(
        `/services/appointments/reschedule-request/order/${orderId}`
      );
      return response.data || null;
    } catch (error: any) {
      // 404 means no request exists
      if (error.response?.status === 404) return null;
      console.error("Failed to get reschedule request:", error.message);
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
      return (response.customers || []).map((c: any) => ({
        customerAddress: c.address,
        customerName: c.name,
        customerEmail: c.email,
        customerPhone: c.phone,
        totalBookings: 0,
        lastVisit: c.createdAt,
      }));
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
