import { apiClient } from "@/shared/utilities/axios";

export interface NoShowHistoryEntry {
  id: string;
  customerAddress: string;
  orderId: string;
  serviceId: string;
  shopId: string;
  scheduledTime: string;
  markedNoShowAt: string;
  markedBy?: string;
  notes?: string;
  gracePeriodMinutes: number;
  customerTierAtTime?: string;
  disputed: boolean;
  disputeStatus?: "pending" | "approved" | "rejected";
  disputeReason?: string;
  disputeSubmittedAt?: string;
  disputeResolvedAt?: string;
  createdAt: string;
}

export interface DisputeResponse {
  dispute: NoShowHistoryEntry;
  autoApproved: boolean;
  message: string;
}

class DisputeApi {
  async submitDispute(
    orderId: string,
    reason: string
  ): Promise<DisputeResponse> {
    try {
      const response = await apiClient.post(
        `/services/orders/${orderId}/dispute`,
        { reason }
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to submit dispute:", error.message);
      throw error;
    }
  }

  async getDisputeStatus(orderId: string): Promise<NoShowHistoryEntry> {
    try {
      const response = await apiClient.get(
        `/services/orders/${orderId}/dispute`
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to get dispute status:", error.message);
      throw error;
    }
  }

  async getCustomerNoShowHistory(
    customerAddress: string,
    limit: number = 10
  ): Promise<{ history: NoShowHistoryEntry[] }> {
    try {
      const response = await apiClient.get(
        `/customers/${customerAddress}/no-show-history`,
        { params: { limit } }
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to get no-show history:", error.message);
      throw error;
    }
  }
}

export const disputeApi = new DisputeApi();
