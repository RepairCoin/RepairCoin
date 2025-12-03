import { CreateCustomerRequest, CustomerData } from "@/interfaces/customer.interface";
import apiClient from "@/utilities/axios";

class CustomerApi {
  async getCustomerByWalletAddress(walletAddress: string): Promise<any> {
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

  async register(payload: CreateCustomerRequest) {
    try {
      return await apiClient.post("/customers/register", payload);
    } catch (error) {
      console.error("Failed to register customer:", error);
      throw error;
    }
  }

  async update(walletAddress: string, payload: CustomerData) {
    try {
      return await apiClient.put<any>(`/customers/${walletAddress}`, payload);
    } catch (error) {
      console.error("Failed to update customer profile:", error);
      throw error;
    }
  }
}

export const customerApi = new CustomerApi();
