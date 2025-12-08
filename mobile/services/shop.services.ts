import apiClient from "@/utilities/axios";
import {
  ShopFormData,
  ShopByWalletAddressResponse,
  ShopCustomersResponse,
  ShopCustomerGrowthResponse,
} from "@/interfaces/shop.interface";

class ShopApi {
  async register(payload: ShopFormData) {
    try {
      return await apiClient.post("/shops/register", payload);
    } catch (error) {
      console.error("Failed to register shop:", error);
      throw error;
    }
  }

  async getShopByWalletAddress(
    walletAddress: string
  ): Promise<ShopByWalletAddressResponse> {
    try {
      return await apiClient.get<ShopByWalletAddressResponse>(
        `/shops/wallet/${walletAddress}`
      );
    } catch (error) {
      console.error("Failed to get shop by wallet address:", error);
      throw error;
    }
  }


  async getShopCustomers(shopId: string): Promise<ShopCustomersResponse> {
    try {
      return await apiClient.get<ShopCustomersResponse>(`/shops/${shopId}/customers?limit=100`);
    } catch (error) {
      console.error("Failed to get shop customers:", error);
      throw error;
    }
  }

  async getShopCustomerGrowth(shopId: string): Promise<ShopCustomerGrowthResponse> {
    try {
      return await apiClient.get<ShopCustomerGrowthResponse>(`/shops/${shopId}/customer-growth?period=7d`);
    } catch (error: any) {
      console.error("Failed to get shop customer growth:", error.message);
      throw error;
    }
  }
}

export const shopApi = new ShopApi();
