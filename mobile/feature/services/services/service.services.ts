import { buildQueryString } from "@/shared/utilities/buildQueryString";
import {
  CreateServiceRequest,
  ServiceResponse,
  ServiceData,
  UpdateServiceData,
  ServiceFilters,
  ServiceDetailResponse,
  ServiceReviewsResponse,
  ReviewFilters,
  BookingFilters,
  BookingFormData,
  BookingResponse,
  BookingAnalytics,
  DisputeEntry,
  RescheduleRequest,
  RescheduleRequestStatus,
  DisputeListResponse,
  ManualBookingData,
  ManualBookingResponse,
  TimeSlot,
  ShopAvailability,
  TimeSlotConfig,
  DateOverride,
  CalendarBooking,
  MyAppointment,
  UpdateAvailabilityRequest,
  CreateDateOverrideRequest,
  CustomerNoShowStatus,
  CustomerSearchResult,
  NoShowHistoryEntry,
  DisputeResponse,
  NoShowPolicy,
  ServiceGroupLink,
  ReviewReply,
} from "@/feature/services/services/service.interface";
import { apiClient } from "@/shared/utilities/axios";

class ServiceApi {
  async getAll(filters?: ServiceFilters): Promise<ServiceResponse> {
    try {
      const queryString = filters ? buildQueryString({...filters}) : "";
      return await apiClient.get<ServiceResponse>(`/services${queryString}`);
    } catch (error: any) {
      console.error("Failed to get all services:", error.message);
      throw error;
    }
  }

  async getShopServices(
    shopId: string,
    options?: { page?: number; limit?: number; search?: string; category?: string }
  ): Promise<ServiceResponse> {
    try {
      const queryString = options ? buildQueryString(options) : "";
      return await apiClient.get<ServiceResponse>(
        `/services/shop/${shopId}${queryString}`
      );
    } catch (error: any) {
      console.error("Failed to get shop services:", error.message);
      throw error;
    }
  }

  async getTrendingServices(options?: { limit?: number; days?: number }): Promise<any> {
    try {
      const queryString = options ? buildQueryString(options) : "";
      return await apiClient.get<any>(`/services/discovery/trending${queryString}`);
    } catch (error: any) {
      console.error("Failed to get trending services:", error.message);
      throw error;
    }
  }

  async getRecentlyViewed(options?: { limit?: number }): Promise<any> {
    try {
      const queryString = options ? buildQueryString(options) : "";
      return await apiClient.get<any>(`/services/discovery/recently-viewed${queryString}`);
    } catch (error: any) {
      console.error("Failed to get recently viewed services:", error.message);
      throw error;
    }
  }

  async trackRecentlyViewed(serviceId: string): Promise<any> {
    try {
      return await apiClient.post(`/services/discovery/recently-viewed`, { serviceId });
    } catch (error: any) {
      console.error("Failed to track recently viewed:", error.message);
      throw error;
    }
  }

  async getSimilarServices(serviceId: string, options?: { limit?: number }): Promise<any> {
    try {
      const queryString = options ? buildQueryString(options) : "";
      return await apiClient.get<any>(`/services/discovery/similar/${serviceId}${queryString}`);
    } catch (error: any) {
      console.error("Failed to get similar services:", error.message);
      throw error;
    }
  }

  async getService(serviceId: string): Promise<ServiceDetailResponse> {
    try {
      return await apiClient.get<ServiceDetailResponse>(`/services/${serviceId}`);
    } catch (error: any) {
      console.error("Failed to get service detail:", error.message);
      throw error;
    }
  }

  async create(
    serviceData: CreateServiceRequest
  ): Promise<{ success: boolean; data?: ServiceData; message?: string }> {
    try {
      return await apiClient.post(`/services`, serviceData);
    } catch (error: any) {
      console.error("Failed to create service:", error.message);
      throw error;
    }
  }

  async update(
    serviceId: string,
    updates: UpdateServiceData
  ): Promise<{ success: boolean; data?: ServiceData; message?: string }> {
    try {
      return await apiClient.put(`/services/${serviceId}`, updates);
    } catch (error: any) {
      console.error("Failed to update service:", error.message);
      throw error;
    }
  }

  async delete(
    serviceId: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.delete(`/services/${serviceId}`);
    } catch (error: any) {
      console.error("Failed to delete service:", error.message);
      throw error;
    }
  }

  async getFavorites(options?: {
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data: ServiceData[]; pagination?: any }> {
    try {
      const queryString = options ? buildQueryString(options) : "";
      return await apiClient.get(`/services/favorites${queryString}`);
    } catch (error: any) {
      console.error("Failed to get favorites:", error.message);
      throw error;
    }
  }

  async addFavorite(
    serviceId: string
  ): Promise<{ success: boolean; data?: any }> {
    try {
      return await apiClient.post(`/services/favorites`, { serviceId });
    } catch (error: any) {
      console.error("Failed to add favorite:", error.message);
      throw error;
    }
  }

  async removeFavorite(
    serviceId: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.delete(`/services/favorites/${serviceId}`);
    } catch (error: any) {
      console.error("Failed to remove favorite:", error.message);
      throw error;
    }
  }

  async checkFavorite(
    serviceId: string
  ): Promise<{ success: boolean; data: { isFavorited: boolean } }> {
    try {
      return await apiClient.get(`/services/favorites/check/${serviceId}`);
    } catch (error: any) {
      console.error("Failed to check favorite:", error.message);
      throw error;
    }
  }

  async getServiceReviews(
    serviceId: string,
    filters?: ReviewFilters
  ): Promise<ServiceReviewsResponse> {
    try {
      const queryString = filters ? buildQueryString(filters) : "";
      return await apiClient.get(`/services/${serviceId}/reviews${queryString}`);
    } catch (error: any) {
      console.error("Failed to get service reviews:", error.message);
      throw error;
    }
  }

  async getShopReviews(
    filters?: ReviewFilters
  ): Promise<ServiceReviewsResponse> {
    try {
      const queryString = filters ? buildQueryString(filters) : "";
      return await apiClient.get(`/services/reviews/shop${queryString}`);
    } catch (error: any) {
      console.error("Failed to get shop reviews:", error.message);
      throw error;
    }
  }

  async addShopResponse(
    reviewId: string,
    response: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.post(`/services/reviews/${reviewId}/respond`, {
        response,
      });
    } catch (error: any) {
      console.error("Failed to add shop response:", error.message);
      throw error;
    }
  }

  async addCustomerReply(
    reviewId: string,
    reply: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.post(`/services/reviews/${reviewId}/reply`, { reply });
    } catch (error: any) {
      console.error("Failed to add customer reply:", error.message);
      throw error;
    }
  }

  async updateCustomerReply(
    reviewId: string,
    reply: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.put(`/services/reviews/${reviewId}/reply`, { reply });
    } catch (error: any) {
      console.error("Failed to update customer reply:", error.message);
      throw error;
    }
  }

  async updateReview(
    reviewId: string,
    data: { rating?: number; comment?: string }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.put(`/services/reviews/${reviewId}`, data);
    } catch (error: any) {
      console.error("Failed to update review:", error.message);
      throw error;
    }
  }

  async updateShopResponse(
    reviewId: string,
    response: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.put(`/services/reviews/${reviewId}/respond`, { response });
    } catch (error: any) {
      console.error("Failed to update shop response:", error.message);
      throw error;
    }
  }

  async addShopRejoinder(
    reviewId: string,
    rejoinder: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.post(`/services/reviews/${reviewId}/rejoinder`, { rejoinder });
    } catch (error: any) {
      console.error("Failed to add shop rejoinder:", error.message);
      throw error;
    }
  }

  async updateShopRejoinder(
    reviewId: string,
    rejoinder: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.put(`/services/reviews/${reviewId}/rejoinder`, { rejoinder });
    } catch (error: any) {
      console.error("Failed to update shop rejoinder:", error.message);
      throw error;
    }
  }

  async addThreadReply(
    reviewId: string,
    content: string
  ): Promise<{ success: boolean; data: ReviewReply }> {
    try {
      return await apiClient.post(`/services/reviews/${reviewId}/thread`, { content });
    } catch (error: any) {
      console.error("Failed to add thread reply:", error.message);
      throw error;
    }
  }

  async editThreadReply(
    replyId: string,
    content: string
  ): Promise<{ success: boolean; data: ReviewReply }> {
    try {
      return await apiClient.put(`/services/reviews/thread/${replyId}`, { content });
    } catch (error: any) {
      console.error("Failed to edit thread reply:", error.message);
      throw error;
    }
  }

  async getShopBookings(filters?: BookingFilters): Promise<BookingResponse> {
    try {
      const queryString = buildQueryString({...filters});
      return await apiClient.get(`/services/orders/shop${queryString}`);
    } catch (error: any) {
      console.error("Failed to get bookings:", error.message);
      throw error;
    }
  }

  async getCustomerBookings(filters?: BookingFilters): Promise<BookingResponse> {
    try {
      const queryString = buildQueryString({...filters});
      return await apiClient.get(`/services/orders/customer${queryString}`);
    } catch (error: any) {
      console.error("Failed to get bookings:", error.message);
      throw error;
    }
  }

  async getOrderById(orderId: string) {
    try {
      return await apiClient.get(`/services/orders/${orderId}`);
    } catch (error: any) {
      console.error("Failed to get order:", error.message);
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, status: string) {
    try {
      return await apiClient.put(`/services/orders/${orderId}/status`, { status });
    } catch (error: any) {
      console.error("Failed to update order status:", error.message);
      throw error;
    }
  }

  async cancelOrder(orderId: string, cancellationReason: string, cancellationNotes?: string) {
    try {
      return await apiClient.post(`/services/orders/${orderId}/cancel`, {
        cancellationReason,
        cancellationNotes,
      });
    } catch (error: any) {
      console.error("Failed to cancel order:", error.message);
      throw error;
    }
  }

  async approveOrder(orderId: string) {
    try {
      return await apiClient.post(`/services/orders/${orderId}/approve`);
    } catch (error: any) {
      console.error("Failed to approve order:", error.message);
      throw error;
    }
  }

  async cancelOrderByShop(orderId: string, cancellationReason: string, cancellationNotes?: string) {
    try {
      return await apiClient.post(`/services/orders/${orderId}/shop-cancel`, {
        cancellationReason,
        cancellationNotes,
      });
    } catch (error: any) {
      console.error("Failed to cancel order by shop:", error.message);
      throw error;
    }
  }

  async confirmPayment(orderId: string, paymentIntentId: string) {
    try {
      return await apiClient.post(`/services/orders/${orderId}/confirm`, { paymentIntentId });
    } catch (error: any) {
      console.error("Failed to confirm payment:", error.message);
      throw error;
    }
  }

  async confirmCheckoutPayment(sessionId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await apiClient.post("/services/orders/confirm", { paymentIntentId: sessionId });
      return { success: true, data: response };
    } catch (error: any) {
      console.error("Failed to confirm checkout payment:", error.message);
      return { success: false, error: error.message };
    }
  }

  async createPaymentIntent(data: BookingFormData) {
    try {
      return await apiClient.post("/services/orders/create-payment-intent", data);
    } catch (error: any) {
      console.error("Failed to create payment intent:", error.message);
      throw error;
    }
  }

  async createStripeCheckout(data: BookingFormData): Promise<{
    data: {
      orderId: string;
      checkoutUrl: string;
      sessionId: string;
      amount: number;
      currency: string;
      totalAmount?: number;
      rcnRedeemed?: number;
      rcnDiscountUsd?: number;
      finalAmount?: number;
    };
  }> {
    try {
      return await apiClient.post("/services/orders/stripe-checkout", data);
    } catch (error: any) {
      console.error("Failed to create Stripe checkout session:", error.message);
      throw error;
    }
  }

  async getBookingAnalytics(trendDays: number = 30): Promise<BookingAnalytics> {
    try {
      const response = await apiClient.get(
        `/services/analytics/shop/bookings?trendDays=${trendDays}`
      );
      return response.data;
    } catch (error: any) {
      console.error("Failed to get booking analytics:", error.message);
      throw error;
    }
  }

  async getShopDisputes(
    shopId: string,
    status?: string,
    page?: number
  ): Promise<DisputeListResponse> {
    try {
      const queryString = buildQueryString({ status, page, limit: 20 });
      const response: any = await apiClient.get(
        `/services/shops/${shopId}/disputes${queryString}`
      );
      return response.data || { disputes: [], total: 0, pendingCount: 0 };
    } catch (error: any) {
      console.error("Failed to get shop disputes:", error.message);
      throw error;
    }
  }

  async approveDispute(
    shopId: string,
    disputeId: string,
    resolutionNotes?: string
  ): Promise<DisputeEntry> {
    try {
      const response: any = await apiClient.put(
        `/services/shops/${shopId}/disputes/${disputeId}/approve`,
        { resolutionNotes }
      );
      return response.data;
    } catch (error: any) {
      console.error("Failed to approve dispute:", error.message);
      throw error;
    }
  }

  async rejectDispute(
    shopId: string,
    disputeId: string,
    resolutionNotes: string
  ): Promise<DisputeEntry> {
    try {
      const response: any = await apiClient.put(
        `/services/shops/${shopId}/disputes/${disputeId}/reject`,
        { resolutionNotes }
      );
      return response.data;
    } catch (error: any) {
      console.error("Failed to reject dispute:", error.message);
      throw error;
    }
  }

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

  async getRescheduleRequestForOrder(
    orderId: string
  ): Promise<RescheduleRequest | null> {
    try {
      const response = await apiClient.get(
        `/services/appointments/reschedule-request/order/${orderId}`
      );
      return response.data || null;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      console.error("Failed to get reschedule request:", error.message);
      throw error;
    }
  }

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

  async cancelAppointment(
    orderId: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.post(
        `/services/appointments/cancel/${orderId}`
      );
    } catch (error: any) {
      console.error("Failed to cancel appointment:", error.message);
      throw error;
    }
  }

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
      return response.data || response || [];
    } catch (error: any) {
      console.error("Failed to get available time slots:", error.message);
      throw error;
    }
  }

  async getShopAvailability(shopId: string): Promise<ShopAvailability[]> {
    try {
      const response = await apiClient.get(
        `/services/appointments/shop-availability/${shopId}`
      );
      return response.data || response || [];
    } catch (error: any) {
      console.error("Failed to get shop availability:", error.message);
      throw error;
    }
  }

  async getTimeSlotConfig(shopId?: string): Promise<TimeSlotConfig | null> {
    try {
      const url = shopId
        ? `/services/appointments/time-slot-config/${shopId}`
        : `/services/appointments/time-slot-config`;
      const response = await apiClient.get(url);
      return response.data || response || null;
    } catch (error: any) {
      console.error("Failed to get time slot config:", error.message);
      throw error;
    }
  }

  async updateShopAvailability(
    data: UpdateAvailabilityRequest
  ): Promise<ShopAvailability> {
    try {
      const response = await apiClient.put(
        `/services/appointments/shop-availability`,
        data
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to update shop availability:", error.message);
      throw error;
    }
  }

  async updateTimeSlotConfig(
    data: Partial<TimeSlotConfig>
  ): Promise<TimeSlotConfig> {
    try {
      const response = await apiClient.put(
        `/services/appointments/time-slot-config`,
        data
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to update time slot config:", error.message);
      throw error;
    }
  }

  async getDateOverrides(
    startDate?: string,
    endDate?: string
  ): Promise<DateOverride[]> {
    try {
      const queryString = buildQueryString({ startDate, endDate });
      const response = await apiClient.get(
        `/services/appointments/date-overrides${queryString}`
      );
      return response.data || response || [];
    } catch (error: any) {
      console.error("Failed to get date overrides:", error.message);
      throw error;
    }
  }

  async createDateOverride(
    data: CreateDateOverrideRequest
  ): Promise<DateOverride> {
    try {
      const response = await apiClient.post(
        `/services/appointments/date-overrides`,
        data
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to create date override:", error.message);
      throw error;
    }
  }

  async deleteDateOverride(
    overrideDate: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.delete(
        `/services/appointments/date-overrides/${overrideDate}`
      );
    } catch (error: any) {
      console.error("Failed to delete date override:", error.message);
      throw error;
    }
  }

  async getShopCalendar(
    startDate: string,
    endDate: string
  ): Promise<CalendarBooking[]> {
    try {
      const queryString = buildQueryString({ startDate, endDate });
      const response = await apiClient.get(
        `/services/appointments/calendar${queryString}`
      );
      return response.data || response || [];
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
      return await apiClient.put(`/services/${serviceId}/duration`, {
        durationMinutes,
      });
    } catch (error: any) {
      console.error("Failed to update service duration:", error.message);
      throw error;
    }
  }

  async getMyAppointments(
    startDate: string,
    endDate: string
  ): Promise<MyAppointment[]> {
    try {
      const queryString = buildQueryString({ startDate, endDate });
      const response = await apiClient.get(
        `/services/appointments/my-appointments${queryString}`
      );
      return response.data || response || [];
    } catch (error: any) {
      console.error("Failed to get my appointments:", error.message);
      throw error;
    }
  }

  async submitDispute(
    orderId: string,
    reason: string
  ): Promise<DisputeResponse> {
    try {
      const response = await apiClient.post(
        `/services/orders/${orderId}/dispute`,
        { reason }
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to submit dispute:", error.message);
      throw error;
    }
  }

  async getDisputeStatus(orderId: string): Promise<NoShowHistoryEntry> {
    try {
      const response = await apiClient.get(
        `/services/orders/${orderId}/dispute`
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to get dispute status:", error.message);
      throw error;
    }
  }

  async getCustomerNoShowHistory(
    customerAddress: string,
    limit: number = 10
  ): Promise<{ history: NoShowHistoryEntry[] }> {
    try {
      const response = await apiClient.get(
        `/customers/${customerAddress}/no-show-history`,
        { params: { limit } }
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to get no-show history:", error.message);
      throw error;
    }
  }

  async getShopPolicy(shopId: string): Promise<NoShowPolicy> {
    try {
      const response = await apiClient.get(
        `/services/shops/${shopId}/no-show-policy`
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to get no-show policy:", error.message);
      throw error;
    }
  }

  async updateShopPolicy(
    shopId: string,
    policy: Partial<NoShowPolicy>
  ): Promise<NoShowPolicy> {
    try {
      const response = await apiClient.put(
        `/services/shops/${shopId}/no-show-policy`,
        policy
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to update no-show policy:", error.message);
      throw error;
    }
  }

  async getServiceGroups(serviceId: string): Promise<ServiceGroupLink[]> {
    try {
      const response = await apiClient.get(`/services/${serviceId}/groups`);
      return response.data || [];
    } catch (error: any) {
      console.error("Failed to get service groups:", error.message);
      throw error;
    }
  }

  async linkServiceToGroup(
    serviceId: string,
    groupId: string,
    tokenRewardPercentage: number = 100,
    bonusMultiplier: number = 1.0
  ): Promise<ServiceGroupLink> {
    try {
      const response = await apiClient.post(
        `/services/${serviceId}/groups/${groupId}`,
        { tokenRewardPercentage, bonusMultiplier }
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to link service to group:", error.message);
      throw error;
    }
  }

  async unlinkServiceFromGroup(
    serviceId: string,
    groupId: string
  ): Promise<void> {
    try {
      await apiClient.delete(`/services/${serviceId}/groups/${groupId}`);
    } catch (error: any) {
      console.error("Failed to unlink service from group:", error.message);
      throw error;
    }
  }

  async updateServiceGroupRewards(
    serviceId: string,
    groupId: string,
    tokenRewardPercentage?: number,
    bonusMultiplier?: number
  ): Promise<ServiceGroupLink> {
    try {
      const response = await apiClient.put(
        `/services/${serviceId}/groups/${groupId}/rewards`,
        { tokenRewardPercentage, bonusMultiplier }
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to update service group rewards:", error.message);
      throw error;
    }
  }
}

export const serviceApi = new ServiceApi();
export const appointmentApi = serviceApi;
export const disputeApi = serviceApi;
export const noShowPolicyApi = serviceApi;
export const serviceGroupApi = serviceApi;
