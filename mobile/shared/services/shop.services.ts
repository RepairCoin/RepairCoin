import apiClient from "@/shared/utilities/axios";
import {
  ShopFormData,
  ShopByWalletAddressResponse,
  ShopCustomersResponse,
  ShopCustomerGrowthResponse,
  ProcessRedemptionRequest,
  ProcessRedemptionResponse,
  CreatePromoCodeRequest,
  PromoCodeResponse,
  PromoCodeValidateResponse,
  ShopResponse,
  ShopData,
  RewardRequest,
  RewardResponse,
  TransactionsResponse,
  PurchasesResponse,
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

  async updateShopDetails(
    shopId: string,
    shopData: ShopFormData
  ): Promise<{ message: string; success: boolean }> {
    try {
      return await apiClient.put<{ message: string; success: boolean }>(
        `/shops/${shopId}/details`,
        shopData
      );
    } catch (error: any) {
      console.error("Failed to update shop details:", error.message);
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
        `/shops/${shopId}`
      );
    } catch (error: any) {
      console.error("Failed to get shop by ID:", error.message);
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
      return await apiClient.get<ShopCustomersResponse>(
        `/shops/${shopId}/customers?limit=100`
      );
    } catch (error) {
      console.error("Failed to get shop customers:", error);
      throw error;
    }
  }

  async getShopCustomerGrowth(
    shopId: string
  ): Promise<ShopCustomerGrowthResponse> {
    try {
      return await apiClient.get<ShopCustomerGrowthResponse>(
        `/shops/${shopId}/customer-growth?period=7d`
      );
    } catch (error: any) {
      console.error("Failed to get shop customer growth:", error.message);
      throw error;
    }
  }

  async processRedemption(
    shopId: string,
    request: ProcessRedemptionRequest
  ): Promise<ProcessRedemptionResponse> {
    try {
      return await apiClient.post(`/shops/${shopId}/redeem`, request);
    } catch (error: any) {
      console.error("Failed to process redemption:", error.message);
      throw error;
    }
  }

  async issueReward(
    shopId: string,
    request: RewardRequest
  ): Promise<RewardResponse> {
    try {
      return await apiClient.post(`/shops/${shopId}/issue-reward`, request);
    } catch (error: any) {
      console.error("Failed to issue reward:", error.message);
      throw error;
    }
  }

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

export const shopApi = new ShopApi();
