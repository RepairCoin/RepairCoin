import { buildQueryString } from "@/shared/utilities/buildQueryString";
import {
  AdLandingResponse,
  AdLeadInput,
  AdPlacementsResponse,
} from "@/feature/services/services/service.interface";
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

  /**
   * Landing data for one campaign — the same PUBLIC endpoint the web page at /l/:campaignId uses,
   * so in-app and web ad clicks show identical copy, offer and promoted services.
   */
  async getLanding(campaignId: string): Promise<AdLandingResponse> {
    try {
      return await apiClient.get<AdLandingResponse>(
        `/ads/landing/${encodeURIComponent(campaignId)}`,
      );
    } catch (error: any) {
      console.error("Failed to get ad landing:", error.message);
      throw error;
    }
  }

  /**
   * Lead capture from the in-app landing form. Same public webform endpoint as the web landing
   * page, so leads from both surfaces attribute and dedupe through one path. Errors propagate —
   * unlike the click log, a dropped lead must be surfaced to the customer so they can retry.
   */
  async submitLead(input: AdLeadInput): Promise<{ success: boolean; data?: { deduped: boolean } }> {
    return apiClient.post("/ads/leads/webform", { ...input, consentToContact: true });
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
