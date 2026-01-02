import apiClient from "@/utilities/axios";
import {
  ShopByWalletAddressResponse,
  ShopCustomerGrowthResponse,
} from "@/interfaces/shop.interface";

/**
 * Shop Home API Services
 * Handles API calls for shop home dashboard data
 */
class ShopHomeApi {
  /**
   * Get shop data by wallet address
   */
  async getShopByWalletAddress(
    walletAddress: string
  ): Promise<ShopByWalletAddressResponse> {
    try {
      return await apiClient.get<ShopByWalletAddressResponse>(
        `/shops/wallet/${walletAddress}`
      );
    } catch (error) {
      console.error("[ShopHomeApi] Failed to get shop by wallet:", error);
      throw error;
    }
  }

  /**
   * Get customer growth statistics for shop dashboard
   */
  async getCustomerGrowth(
    shopId: string,
    period: string = "7d"
  ): Promise<ShopCustomerGrowthResponse> {
    try {
      return await apiClient.get<ShopCustomerGrowthResponse>(
        `/shops/${shopId}/customer-growth?period=${period}`
      );
    } catch (error) {
      console.error("[ShopHomeApi] Failed to get customer growth:", error);
      throw error;
    }
  }
}

export const shopHomeApi = new ShopHomeApi();
