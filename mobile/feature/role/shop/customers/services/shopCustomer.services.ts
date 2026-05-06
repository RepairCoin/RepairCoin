import apiClient from "@/shared/utilities/axios";
import {
  ShopCustomersResponse,
  ShopCustomerGrowthResponse,
} from "@/shared/interfaces/shop.interface";

class ShopCustomerApi {
  async getShopCustomers(shopId: string): Promise<ShopCustomersResponse> {
    try {
      return await apiClient.get<ShopCustomersResponse>(
        `/shops/${shopId}/customers?limit=100`,
      );
    } catch (error) {
      console.error("Failed to get shop customers:", error);
      throw error;
    }
  }

  async getShopCustomerGrowth(
    shopId: string,
    period: string = "7d",
  ): Promise<ShopCustomerGrowthResponse> {
    try {
      return await apiClient.get<ShopCustomerGrowthResponse>(
        `/shops/${shopId}/customer-growth?period=${period}`,
      );
    } catch (error: any) {
      console.error("Failed to get shop customer growth:", error.message);
      throw error;
    }
  }
}

export const shopCustomerApi = new ShopCustomerApi();
