import apiClient from "@/shared/utilities/axios";
import {
  ShopFormData,
  ShopByWalletAddressResponse,
  ShopResponse,
} from "@/shared/interfaces/shop.interface";

class ShopApi {
  async register(payload: ShopFormData) {
    try {
      return await apiClient.post("/shops/register", payload);
    } catch (error) {
      console.error("Failed to register shop:", error);
      throw error;
    }
  }

  async updateShopDetails(
    shopId: string,
    shopData: ShopFormData,
  ): Promise<{ message: string; success: boolean }> {
    try {
      const response = await apiClient.put<{
        message: string;
        success: boolean;
      }>(`/shops/${shopId}/details`, shopData);
      return response;
    } catch (error: any) {
      console.error("Failed to update shop details:", error.message, error);
      throw error;
    }
  }

  async listShops(): Promise<ShopResponse> {
    try {
      return await apiClient.get<ShopResponse>("/shops");
    } catch (error: any) {
      console.error("Failed to list shops:", error.message);
      throw error;
    }
  }

  async getShopById(shopId: string): Promise<ShopByWalletAddressResponse> {
    try {
      return await apiClient.get<ShopByWalletAddressResponse>(
        `/shops/${shopId}`,
      );
    } catch (error: any) {
      console.error("Failed to get shop by ID:", error.message);
      throw error;
    }
  }

  async getShopByWalletAddress(
    walletAddress: string,
  ): Promise<ShopByWalletAddressResponse> {
    try {
      return await apiClient.get<ShopByWalletAddressResponse>(
        `/shops/wallet/${walletAddress}`,
      );
    } catch (error) {
      console.error("Failed to get shop by wallet address:", error);
      throw error;
    }
  }

}

export const shopApi = new ShopApi();
