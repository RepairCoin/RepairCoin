import apiClient from "@/shared/utilities/axios";
import {
  CreatePromoCodeRequest,
  PromoCodeResponse,
  PromoCodesListResponse,
  PromoCodeValidateResponse,
} from "@/shared/interfaces/shop.interface";

class PromoCodeApi {
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
}

export const promoCodeApi = new PromoCodeApi();
