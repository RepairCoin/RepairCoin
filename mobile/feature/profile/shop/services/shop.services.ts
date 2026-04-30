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
  PromoCodesListResponse,
  PromoCodeValidateResponse,
  ShopResponse,
  RewardRequest,
  RewardResponse,
  TransactionsResponse,
  PurchasesResponse,
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

  async processRedemption(
    shopId: string,
    request: ProcessRedemptionRequest,
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
    request: RewardRequest,
  ): Promise<RewardResponse> {
    try {
      return await apiClient.post(`/shops/${shopId}/issue-reward`, request);
    } catch (error: any) {
      console.error("Failed to issue reward:", error.message);
      throw error;
    }
  }

  async getRecentRewards(shopId: string, limit: number = 5): Promise<any> {
    try {
      return await apiClient.get(
        `/shops/${shopId}/transactions?type=reward&limit=${limit}`,
      );
    } catch (error: any) {
      console.error("Failed to get recent rewards:", error.message);
      throw error;
    }
  }

  // Promo Code Methods

  async getPromoCodes(shopId: string): Promise<PromoCodesListResponse> {
    try {
      return await apiClient.get<PromoCodesListResponse>(
        `/shops/${shopId}/promo-codes`,
      );
    } catch (error) {
      console.error("Failed to get promo codes:", error);
      throw error;
    }
  }

  async createPromoCode(
    shopId: string,
    data: CreatePromoCodeRequest,
  ): Promise<PromoCodeResponse> {
    try {
      return await apiClient.post(`/shops/${shopId}/promo-codes`, data);
    } catch (error) {
      console.error("Failed to create promo code:", error);
      throw error;
    }
  }

  async validatePromoCode(
    shopId: string,
    data: { code: string; customer_address: string },
  ): Promise<PromoCodeValidateResponse> {
    try {
      return await apiClient.post(
        `/shops/${shopId}/promo-codes/validate`,
        data,
      );
    } catch (error) {
      console.error("Failed to validate promo code:", error);
      throw error;
    }
  }

  async updatePromoCodeStatus(
    shopId: string,
    promoCodeId: string,
    isActive: boolean,
  ): Promise<PromoCodeResponse> {
    try {
      if (!isActive) {
        return await apiClient.delete(
          `/shops/${shopId}/promo-codes/${promoCodeId}`,
        );
      }
      return await apiClient.put(
        `/shops/${shopId}/promo-codes/${promoCodeId}`,
        { is_active: true },
      );
    } catch (error) {
      console.error("Failed to update promo code status:", error);
      throw error;
    }
  }

  async deletePromoCode(
    shopId: string,
    promoCodeId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await apiClient.delete(
        `/shops/${shopId}/promo-codes/${promoCodeId}`,
      );
    } catch (error) {
      console.error("Failed to delete promo code:", error);
      throw error;
    }
  }

  // Analytics Methods

  async getShopTransactions(
    shopId: string,
    startDate: string,
    endDate: string,
  ): Promise<TransactionsResponse> {
    try {
      return await apiClient.get(
        `/shops/${shopId}/transactions?startDate=${startDate}&endDate=${endDate}`,
      );
    } catch (error: any) {
      console.error("Failed to get shop transactions:", error.message);
      throw error;
    }
  }

  async getShopPurchases(
    shopId: string,
    startDate: string,
    endDate: string,
  ): Promise<PurchasesResponse> {
    try {
      return await apiClient.get(
        `/shops/${shopId}/purchases?startDate=${startDate}&endDate=${endDate}`,
      );
    } catch (error: any) {
      console.error("Failed to get shop purchases:", error.message);
      throw error;
    }
  }
}

export const shopApi = new ShopApi();
