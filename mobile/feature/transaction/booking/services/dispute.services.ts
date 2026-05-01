import { apiClient } from "@/shared/utilities/axios";
import { buildQueryString } from "@/shared/utilities/buildQueryString";

export interface DisputeEntry {
  id: string;
  customerAddress: string;
  orderId: string;
  serviceId: string;
  shopId: string;
  scheduledTime: string;
  markedNoShowAt: string;
  notes?: string;
  customerTierAtTime?: string;
  disputed: boolean;
  disputeStatus?: "pending" | "approved" | "rejected";
  disputeReason?: string;
  disputeSubmittedAt?: string;
  disputeResolvedAt?: string;
  disputeResolvedBy?: string;
  disputeResolutionNotes?: string;
  serviceName?: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
}

export interface DisputeListResponse {
  disputes: DisputeEntry[];
  total: number;
  pendingCount: number;
}

class DisputeApi {
  async getShopDisputes(
    shopId: string,
    status?: string,
    page?: number
  ): Promise<DisputeListResponse> {
    try {
      const queryString = buildQueryString({ status, page, limit: 20 });
      const response: any = await apiClient.get(
        `/services/shops/${shopId}/disputes${queryString}`
      );
      return response.data || { disputes: [], total: 0, pendingCount: 0 };
    } catch (error: any) {
      console.error("Failed to get shop disputes:", error.message);
      throw error;
    }
  }

  async approveDispute(
    shopId: string,
    disputeId: string,
    resolutionNotes?: string
  ): Promise<DisputeEntry> {
    try {
      const response: any = await apiClient.put(
        `/services/shops/${shopId}/disputes/${disputeId}/approve`,
        { resolutionNotes }
      );
      return response.data;
    } catch (error: any) {
      console.error("Failed to approve dispute:", error.message);
      throw error;
    }
  }

  async rejectDispute(
    shopId: string,
    disputeId: string,
    resolutionNotes: string
  ): Promise<DisputeEntry> {
    try {
      const response: any = await apiClient.put(
        `/services/shops/${shopId}/disputes/${disputeId}/reject`,
        { resolutionNotes }
      );
      return response.data;
    } catch (error: any) {
      console.error("Failed to reject dispute:", error.message);
      throw error;
    }
  }
}

export const disputeApi = new DisputeApi();
