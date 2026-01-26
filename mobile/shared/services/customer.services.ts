import { CustomerFormData, CustomerData, CustomerResponse } from "@/interfaces/customer.interface";
import apiClient from "@/shared/utilities/axios";

// Cross-shop balance response type
export interface CrossShopBalanceResponse {
  success: boolean;
  data: {
    totalRedeemableBalance: number;
    crossShopLimit: number;
    availableForCrossShop: number;
    homeShopBalance: number;
  };
}

class CustomerApi {
  async getCustomerByWalletAddress(walletAddress: string): Promise<CustomerResponse> {
    try {
      return await apiClient.get<any>(`/customers/${walletAddress}`);
    } catch (error) {
      console.error("Failed to fetch customer:", error);
      throw error;
    }
  }

  async getTransactionByWalletAddress(walletAddress: string, limit: number): Promise<any> {
    try {
      return await apiClient.get<any>(`/customers/${walletAddress}/transactions?limit=${limit}`);
    } catch (error) {
      console.error("Failed to fetch earning history:", error);
      throw error;
    }
  };

  /**
   * Get customer's cross-shop balance breakdown
   * Returns 20% limit for cross-shop redemptions
   */
  async getCrossShopBalance(walletAddress: string): Promise<CrossShopBalanceResponse> {
    try {
      return await apiClient.get<CrossShopBalanceResponse>(
        `/customers/cross-shop/balance/${walletAddress}`
      );
    } catch (error) {
      console.error("Failed to fetch cross-shop balance:", error);
      throw error;
    }
  }

  /**
   * Check if customer has earned RCN at a specific shop
   * Used to determine home shop status (100% vs 20% redemption)
   */
  async hasEarnedAtShop(walletAddress: string, shopId: string): Promise<boolean> {
    try {
      // Fetch recent transactions and check if any earnings are from this shop
      const response = await apiClient.get<any>(
        `/customers/${walletAddress}/transactions?limit=100`
      );
      const transactions = response?.data?.transactions || [];

      // Check if customer has any earning transactions from this shop
      return transactions.some(
        (tx: any) =>
          tx.shopId === shopId &&
          (tx.type === 'earn' || tx.type === 'mint' || tx.type === 'reward')
      );
    } catch (error) {
      console.error("Failed to check home shop status:", error);
      return false; // Default to cross-shop (20% limit) if check fails
    }
  }

  async register(payload: CustomerFormData) {
    try {
      return await apiClient.post("/customers/register", payload);
    } catch (error) {
      console.error("Failed to register customer:", error);
      throw error;
    }
  }

  async update(walletAddress: string, payload: Partial<CustomerData>) {
    try {
      return await apiClient.put<any>(`/customers/${walletAddress}`, payload);
    } catch (error) {
      console.error("Failed to update customer profile:", error);
      throw error;
    }
  }
}

export const customerApi = new CustomerApi();
