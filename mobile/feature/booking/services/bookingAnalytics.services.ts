import { apiClient } from "@/shared/utilities/axios";
import { BookingAnalytics } from "../types";

class BookingAnalyticsApi {
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
}

export const bookingAnalyticsApi = new BookingAnalyticsApi();
