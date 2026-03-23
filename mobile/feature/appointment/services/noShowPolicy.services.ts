import { apiClient } from "@/shared/utilities/axios";

export interface NoShowPolicy {
  shopId: string;
  enabled: boolean;
  gracePeriodMinutes: number;
  minimumCancellationHours: number;
  autoDetectionEnabled: boolean;
  autoDetectionDelayHours: number;
  // Penalty Tiers
  cautionThreshold: number;
  cautionAdvanceBookingHours: number;
  depositThreshold: number;
  depositAmount: number;
  depositAdvanceBookingHours: number;
  depositResetAfterSuccessful: number;
  maxRcnRedemptionPercent: number;
  suspensionThreshold: number;
  suspensionDurationDays: number;
  // Notifications
  sendEmailTier1: boolean;
  sendEmailTier2: boolean;
  sendEmailTier3: boolean;
  sendEmailTier4: boolean;
  sendSmsTier2: boolean;
  sendSmsTier3: boolean;
  sendSmsTier4: boolean;
  sendPushNotifications: boolean;
  // Disputes
  allowDisputes: boolean;
  disputeWindowDays: number;
  autoApproveFirstOffense: boolean;
  requireShopReview: boolean;
}

class NoShowPolicyApi {
  async getShopPolicy(shopId: string): Promise<NoShowPolicy> {
    try {
      const response = await apiClient.get(
        `/services/shops/${shopId}/no-show-policy`
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to get no-show policy:", error.message);
      throw error;
    }
  }

  async updateShopPolicy(
    shopId: string,
    policy: Partial<NoShowPolicy>
  ): Promise<NoShowPolicy> {
    try {
      const response = await apiClient.put(
        `/services/shops/${shopId}/no-show-policy`,
        policy
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to update no-show policy:", error.message);
      throw error;
    }
  }
}

export const noShowPolicyApi = new NoShowPolicyApi();
