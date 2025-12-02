import apiClient from "@/utilities/axios";
import {
  CreateShopRequest,
  ShopByWalletAddressResponse,
} from "../interfaces/shop.interface";

class ShopApi {
  async register(registrationData: CreateShopRequest) {
    try {
      return await apiClient.post("/shops/register", registrationData);
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
}

export const shopApi = new ShopApi();
