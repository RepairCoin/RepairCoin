import { apiClient } from "@/utilities/axios";
import { buildQueryString } from "@/utilities/buildQueryString";
import { BookingFilters, BookingFormData, BookingResponse } from "@/interfaces/booking.interfaces";
import { StripeCheckoutResponse } from "../types";

class BookingApi {
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

  async cancelOrder(orderId: string) {
    try {
      return await apiClient.post(`/services/orders/${orderId}/cancel`);
    } catch (error: any) {
      console.error("Failed to cancel order:", error.message);
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

  /**
   * Confirm payment after Stripe Checkout completion
   * This updates order status and processes RCN redemption
   */
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

  /**
   * Create a Stripe Checkout session for web-based booking payment
   * This avoids Apple's 30% IAP fee by redirecting to browser
   */
  async createStripeCheckout(data: BookingFormData): Promise<StripeCheckoutResponse> {
    try {
      return await apiClient.post("/services/orders/stripe-checkout", data);
    } catch (error: any) {
      console.error("Failed to create Stripe checkout session:", error.message);
      throw error;
    }
  }
}

export const bookingApi = new BookingApi();
