import apiClient from "@/utilities/axios";

class BalanceAppi {
  async getCustomerBalance(customerAddress: string): Promise<any> {
    try {
      return await apiClient.get(`/customers/balance/${customerAddress}`);
    } catch (error: any) {
      console.error("Failed to get customer balance:", error.message);
      throw error;
    }
  }
}

export const balanceApi = new BalanceAppi();