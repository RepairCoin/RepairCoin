import { apiClient } from "@/utilities/axios";
import { TransactionsResponse, PurchasesResponse } from "../types";

class AnalyticsApi {
  /**
   * Get shop transactions (rewards/redemptions)
   */
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

  /**
   * Get shop RCN purchases (costs)
   */
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

  /**
   * Fetch both transactions and purchases in parallel
   */
  async getProfitData(
    shopId: string,
    startDate: string,
    endDate: string
  ): Promise<{ transactions: TransactionsResponse; purchases: PurchasesResponse }> {
    try {
      const [transactions, purchases] = await Promise.all([
        this.getShopTransactions(shopId, startDate, endDate).catch(() => ({
          success: false,
          data: { transactions: [], total: 0, totalPages: 0, page: 1 },
        })),
        this.getShopPurchases(shopId, startDate, endDate).catch(() => ({
          success: false,
          data: {
            items: [],
            pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0, hasMore: false },
          },
        })),
      ]);

      return { transactions, purchases };
    } catch (error: any) {
      console.error("Failed to get profit data:", error.message);
      throw error;
    }
  }
}

export const analyticsApi = new AnalyticsApi();
