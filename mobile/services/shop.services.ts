import apiClient from "@/utilities/axios";
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

  async getShopPromoCodes(shopId: string): Promise<any> {
    try {
      return await apiClient.get(`/shops/${shopId}/promo-codes`);
    } catch (error: any) {
      console.error("Failed to get shop promo codes:", error.message);
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

  async createPromoCode(
    shopId: string,
    promoCodeData: CreatePromoCodeRequest
  ): Promise<PromoCodeResponse> {
    try {
      return await apiClient.post(
        `/shops/${shopId}/promo-codes`,
        promoCodeData
      );
    } catch (error: any) {
      console.error("Failed to create promo code:", error.message);
      throw error;
    }
  }

  async updatePromoCodeStatus(
    shopId: string,
    promoCodeId: string,
    isActive: boolean
  ): Promise<any> {
    try {
      if (!isActive) {
        // Use DELETE endpoint to deactivate
        return await apiClient.delete(
          `/shops/${shopId}/promo-codes/${promoCodeId}`
        );
      } else {
        // Use PUT endpoint to reactivate by updating is_active flag
        return await apiClient.put(
          `/shops/${shopId}/promo-codes/${promoCodeId}`,
          {
            is_active: true,
          }
        );
      }
    } catch (error: any) {
      console.error("Failed to update promo code status:", error.message);
      throw error;
    }
  }

  async validatePromoCode(
    shopId: string,
    request: {
      code: string;
      customer_address: string;
    }
  ): Promise<PromoCodeValidateResponse> {
    try {
      return await apiClient.post(
        `/shops/${shopId}/promo-codes/validate`,
        request
      );
    } catch (error: any) {
      console.error("Failed to validate promo code:", error.message);
      throw error;
    }
  }
}

export const shopApi = new ShopApi();
