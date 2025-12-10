import apiClient from "@/utilities/axios";
import { CustomerBalanceResponse } from "@/interfaces/balance.interface";

class BalanceAppi {
  async getCustomerBalance(customerAddress: string): Promise<CustomerBalanceResponse> {
    try {
      return await apiClient.get<CustomerBalanceResponse>(
        `/customers/balance/${customerAddress}`
      );
    } catch (error: any) {
      console.error("Failed to get customer balance:", error.message);
      throw error;
    }
  }
}

export const balanceApi = new BalanceAppi();