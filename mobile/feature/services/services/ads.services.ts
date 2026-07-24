import { buildQueryString } from "@/shared/utilities/buildQueryString";
import { AdPlacementsResponse } from "@/feature/services/services/service.interface";
import { apiClient } from "@/shared/utilities/axios";

/**
 * In-app ad placements (sponsored cards backed by ad_campaigns). Read-only plus a tap log —
 * the ads themselves are authored in the admin ads panel, not here.
 */
class AdsApi {
  async getAppPlacements(options?: {
    limit?: number;
    placement?: string;
  }): Promise<AdPlacementsResponse> {
    try {
      const queryString = options ? buildQueryString({ ...options }) : "";
      return await apiClient.get<AdPlacementsResponse>(`/ads/app-placements${queryString}`);
    } catch (error: any) {
      console.error("Failed to get ad placements:", error.message);
      throw error;
    }
  }

  /** Fire-and-forget tap log. Callers must not block navigation on this. */
  async recordAdClick(campaignId: string, placement: string): Promise<void> {
    try {
      await apiClient.post(`/ads/app-placements/${campaignId}/click`, { placement });
    } catch (error: any) {
      // Analytics is best-effort: a lost click must never surface to the customer.
      console.warn("Failed to record ad click:", error.message);
    }
  }
}

export const adsApi = new AdsApi();
export default adsApi;
