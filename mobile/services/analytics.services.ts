import { apiClient } from "@/utilities/axios";
import {
  TransactionsResponse,
  PurchasesResponse,
} from "@/interfaces/shop.interface";

class AnalyticsApi {
  async getShopTransactions(
    shopId: string,
    startDate: string,
    endDate: string
  ): Promise<TransactionsResponse> {
    try {
      return await apiClient.get(
        `/shops/${shopId}/transactions?startDate=${startDate}&endDate=${endDate}`
      );
    } catch (error: any) {
      console.error("Failed to get shop transactions:", error.message);
      throw error;
    }
  }

  async getShopPurchases(
    shopId: string,
    startDate: string,
    endDate: string
  ): Promise<PurchasesResponse> {
    try {
      return await apiClient.get(
        `/shops/${shopId}/purchases?startDate=${startDate}&endDate=${endDate}`
      );
    } catch (error: any) {
      console.error("Failed to get shop purchases:", error.message);
      throw error;
    }
  }
}

export const analyticsApi = new AnalyticsApi();
