import apiClient from "@/shared/utilities/axios";
import {
  ShopFormData,
  ShopByWalletAddressResponse,
  ShopResponse,
  ShopCustomersResponse,
  ShopCustomerGrowthResponse,
  TransactionsResponse,
  PurchasesResponse,
  ProcessRedemptionRequest,
  ProcessRedemptionResponse,
  CreatePromoCodeRequest,
  PromoCodeResponse,
  PromoCodesListResponse,
  PromoCodeValidateResponse,
  RewardRequest,
  RewardResponse,
  SubmitIssueReportRequest,
  SubmitIssueReportResponse,
  BlockCustomerRequest,
  BlockCustomerResponse,
  BlockedCustomersResponse,
  CustomerBlockStatusResponse,
} from "./shop.interface";
import {
  PurchaseHistoryResponse,
  ShopTransactionHistoryResponse,
} from "@/feature/token/services/token.interface";
import { StripeCheckoutResponse } from "@/feature/token/services/token.interface";

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

  async processRedemption(
    shopId: string,
    request: ProcessRedemptionRequest,
  ): Promise<ProcessRedemptionResponse> {
    try {
      return await apiClient.post<ProcessRedemptionResponse>(
        `/shops/${shopId}/redeem`,
        request,
      );
    } catch (error: any) {
      console.error("Failed to process redemption:", error.message);
      throw error;
    }
  }

  async getRecentRewards(shopId: string, limit: number = 5) {
    try {
      return await apiClient.get(
        `/shops/${shopId}/transactions?limit=${limit}&type=rewards`,
      );
    } catch (error: any) {
      console.error("Failed to get recent rewards:", error.message);
      throw error;
    }
  }

  // ─── Reward Endpoints ───────────────────────────────────────────────────────

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

  // ==================== Moderation: Blocked Customers ====================
  // Backend derives the shop from the auth token; shopId is not in the path.
  async blockCustomer(
    data: BlockCustomerRequest,
  ): Promise<BlockCustomerResponse> {
    try {
      return await apiClient.post(`/shops/moderation/block-customer`, data);
    } catch (error: any) {
      console.error("Failed to block customer:", error.message);
      throw error;
    }
  }

  async unblockCustomer(
    walletAddress: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.delete(
        `/shops/moderation/blocked-customers/${walletAddress}`,
      );
    } catch (error: any) {
      console.error("Failed to unblock customer:", error.message);
      throw error;
    }
  }

  async getBlockedCustomers(): Promise<BlockedCustomersResponse> {
    try {
      return await apiClient.get(`/shops/moderation/blocked-customers`);
    } catch (error: any) {
      console.error("Failed to get blocked customers:", error.message);
      throw error;
    }
  }

  async getCustomerBlockStatus(
    walletAddress: string,
  ): Promise<CustomerBlockStatusResponse> {
    try {
      return await apiClient.get(
        `/shops/moderation/blocked-customers/${walletAddress}/status`,
      );
    } catch (error: any) {
      console.error("Failed to get block status:", error.message);
      throw error;
    }
  }

  // Submit a moderation issue report (spam / fraud / harassment / etc.).
  // The backend derives the shop from the auth token; shopId is not in the path.
  async submitIssueReport(
    data: SubmitIssueReportRequest,
  ): Promise<SubmitIssueReportResponse> {
    try {
      return await apiClient.post(`/shops/moderation/reports`, data);
    } catch (error: any) {
      console.error("Failed to submit issue report:", error.message);
      throw error;
    }
  }

  async getRewardHistory(shopId: string, limit: number = 5): Promise<any> {
    try {
      return await apiClient.get(
        `/shops/${shopId}/transactions?type=reward&limit=${limit}`,
      );
    } catch (error: any) {
      console.error("Failed to get reward history:", error.message);
      throw error;
    }
  }

  // ─── Promo Code Endpoints ──────────────────────────────────────────────────

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

  // ─── Purchase Endpoints ─────────────────────────────────────────────────────

  async createTokenPurchasePaymentIntent(amount: number): Promise<any> {
    try {
      return await apiClient.post<any>(
        "/shops/purchase/stripe-payment-intent",
        { amount },
      );
    } catch (error: any) {
      console.error("Failed to create token purchase payment intent:", error.message);
      throw error;
    }
  }

  async createStripeCheckout(amount: number): Promise<StripeCheckoutResponse> {
    try {
      return await apiClient.post("/shops/purchase/stripe-checkout", {
        amount,
        platform: "mobile",
      });
    } catch (error: any) {
      console.error("Failed to create Stripe checkout session:", error.message);
      throw error;
    }
  }

  async getPurchaseHistory(shopId: string): Promise<PurchaseHistoryResponse> {
    try {
      return await apiClient.get(`/shops/purchase/history/${shopId}`);
    } catch (error: any) {
      console.error("Failed to get purchase history:", error.message);
      throw error;
    }
  }

  async checkPaymentStatus(purchaseId: string): Promise<any> {
    try {
      return await apiClient.post(`/shops/purchase-sync/check-payment/${purchaseId}`);
    } catch (error: any) {
      console.error("Failed to check payment status:", error.message);
      throw error;
    }
  }

  // Unified transaction history: rewards issued, redemptions processed, RCN purchases
  async getShopTransactionHistory(
    shopId: string,
    type?: string,
    limit: number = 100,
  ): Promise<ShopTransactionHistoryResponse> {
    try {
      const typeParam = type && type !== "all" ? `&type=${type}` : "";
      return await apiClient.get(
        `/shops/${shopId}/transactions?limit=${limit}${typeParam}`,
      );
    } catch (error: any) {
      console.error("Failed to get shop transaction history:", error.message);
      throw error;
    }
  }
}

export const shopApi = new ShopApi();
