import { apiClient } from "@/utilities/axios";
import { buildQueryString } from "@/utilities/helper/buildQueryString";

class BookingApi {
  async getShopBookings(shopId: string) {
    try {
      const queryString = buildQueryString({ shopId });
      return await apiClient.get(`/services/orders/shop${queryString}`);
    } catch (error: any) {
      console.error("Failed to get bookings:", error.message);
      throw error;
    }
  }

  async getCustomerBookings() {
    try {
      const queryString = buildQueryString({});
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

  async createPaymentIntent(data: any) {
    try {
      return await apiClient.post("/services/orders/create-payment-intent", data);
    } catch (error: any) {
      console.error("Failed to create payment intent:", error.message);
      throw error;
    }
  }
}

export const bookingApi = new BookingApi();
