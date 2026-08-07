import apiClient from "@/shared/utilities/axios";
import {
  RecPresentation,
  RecommendationsData,
  RecommendationsResponse,
} from "./aiRecommendations.interface";

class AiRecommendationsApi {
  /**
   * GET /ai/recommendations — the same engine that feeds the web dashboard.
   * Tier-gated on the server (aiInsights / Growth): a below-tier shop gets a 403,
   * which callers treat as "no section", not an error.
   */
  async list(
    limit?: number,
    presentation: RecPresentation = "card",
  ): Promise<RecommendationsData> {
    try {
      const response = await apiClient.get<RecommendationsResponse>(
        "/ai/recommendations",
        { params: { ...(limit ? { limit } : {}), presentation } },
      );
      return {
        recommendations: response.data?.recommendations ?? [],
        gatedCount: response.data?.gatedCount ?? 0,
      };
    } catch (error: any) {
      console.error("Failed to load AI recommendations:", error.message);
      throw error;
    }
  }
}

export const aiRecommendationsApi = new AiRecommendationsApi();
