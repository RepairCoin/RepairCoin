import apiClient from "@/utilities/axios";
import {
  CreatePromoCodeRequest,
  PromoCodeResponse,
} from "@/interfaces/shop.interface";

export interface PromoCode {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PromoCodesResponse {
  success: boolean;
  data: PromoCode[];
}

/**
 * Promo Code API Services
 * Handles API calls for promo code management
 */
class PromoCodeApi {
  /**
   * Get all promo codes for a shop
   */
  async getPromoCodes(shopId: string): Promise<PromoCodesResponse> {
    try {
      return await apiClient.get<PromoCodesResponse>(
        `/shops/${shopId}/promo-codes`
      );
    } catch (error) {
      console.error("[PromoCodeApi] Failed to get promo codes:", error);
      throw error;
    }
  }

  /**
   * Create a new promo code
   */
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

  /**
   * Toggle promo code active status
   */
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
      console.error("[PromoCodeApi] Failed to update promo code status:", error);
      throw error;
    }
  }

  /**
   * Delete a promo code permanently
   */
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
}

export const promoCodeApi = new PromoCodeApi();
