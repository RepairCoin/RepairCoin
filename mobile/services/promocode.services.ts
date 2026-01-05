import apiClient from "@/utilities/axios";
import {
  CreatePromoCodeRequest,
  PromoCodeResponse,
  PromoCodeValidateResponse,
} from "@/interfaces/shop.interface";

class PromoCodeApi {
  async getPromoCodes(shopId: string): Promise<PromoCodeResponse> {
    try {
      return await apiClient.get<PromoCodeResponse>(
        `/shops/${shopId}/promo-codes`
      );
    } catch (error) {
      console.error("[PromoCodeApi] Failed to get promo codes:", error);
      throw error;
    }
  }

  async createPromoCode(
    shopId: string,
    data: CreatePromoCodeRequest
  ): Promise<PromoCodeResponse> {
    try {
      return await apiClient.post<PromoCodeResponse>(
        `/shops/${shopId}/promo-codes`,
        data
      );
    } catch (error) {
      console.error("[PromoCodeApi] Failed to create promo code:", error);
      throw error;
    }
  }

  async updateStatus(
    shopId: string,
    promoCodeId: string,
    isActive: boolean
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!isActive) {
        // Deactivate using DELETE
        return await apiClient.delete(
          `/shops/${shopId}/promo-codes/${promoCodeId}`
        );
      } else {
        // Reactivate using PUT
        return await apiClient.put(
          `/shops/${shopId}/promo-codes/${promoCodeId}`,
          { is_active: true }
        );
      }
    } catch (error) {
      console.error(
        "[PromoCodeApi] Failed to update promo code status:",
        error
      );
      throw error;
    }
  }

  async deletePromoCode(
    shopId: string,
    promoCodeId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await apiClient.delete(
        `/shops/${shopId}/promo-codes/${promoCodeId}?permanent=true`
      );
    } catch (error) {
      console.error("[PromoCodeApi] Failed to delete promo code:", error);
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

export const promoCodeApi = new PromoCodeApi();
