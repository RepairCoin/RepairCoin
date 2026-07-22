// frontend/src/services/api/aiRecommendations.ts
//
// Shop dashboard "AI Recommendations for You" feed.
// Backed by backend/src/domains/AIAgentDomain/controllers/RecommendationsController.ts
//
//   GET  /api/ai/recommendations             — active cards for this shop
//   POST /api/ai/recommendations/:id/dismiss — snooze (default) or dismiss
//   POST /api/ai/recommendations/:id/acted   — record a tap-through
//
// All three are gated on aiInsights (Growth) server-side and shop-scoped from
// the JWT. Each card ALSO carries its own tier requirement, already applied by
// the backend — the client never receives a card it cannot act on.

import apiClient from "./client";

export type RecCategory =
  | "revenue"
  | "customers"
  | "marketing"
  | "inventory"
  | "operations";

export type RecSeverity = "low" | "medium" | "high";

/** Typed destination for a card tap. Mirror of the backend's RecAction. */
export type RecAction =
  | { kind: "navigate"; tab: string; sub?: string }
  | { kind: "assistant"; prompt: string }
  | { kind: "campaign"; audience: string };

/** Which dashboard surface renders this — one engine, two surfaces.
 *  'card' = the AI Recommendations list, 'action' = the Priority Actions grid. */
export type RecPresentation = "card" | "action";

export interface Recommendation {
  id: string;
  detectorKey: string;
  category: RecCategory;
  severity: RecSeverity;
  title: string;
  description: string;
  action: RecAction;
  /** Always present — powers the secondary "ask AI about this" tap even when
   *  the primary action navigates. Templated from the detector's evidence. */
  assistantPrompt: string | null;
  /** The numbers behind the copy. Every figure in title/description comes from
   *  here, so a card can never claim something nothing computed. */
  evidence: Record<string, number | string>;
  presentation: RecPresentation;
  /** Button text for a Priority Action tile ("Contact Leads"). Null for cards. */
  ctaLabel: string | null;
  detectedAt: string;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  /** How many active cards this shop's tier hides — backs the honest
   *  "N more available on <plan>" line instead of dangling locked cards. */
  gatedCount: number;
}

export const aiRecommendationsApi = {
  async list(
    limit?: number,
    presentation: RecPresentation = "card"
  ): Promise<RecommendationsResponse> {
    const response = await apiClient.get("/ai/recommendations", {
      params: { ...(limit ? { limit } : {}), presentation },
    });
    // The axios interceptor already unwraps `response.data`, so the payload is
    // at response.data.<key> — never response.data.data.<key>.
    return {
      recommendations: response.data?.recommendations ?? [],
      gatedCount: response.data?.gatedCount ?? 0,
    };
  },

  /** `permanent: true` = never show this card again; default is a 14-day
   *  snooze so a recurring condition can resurface. */
  async dismiss(id: string, permanent = false): Promise<void> {
    await apiClient.post(`/ai/recommendations/${id}/dismiss`, { permanent });
  },

  /** Fire-and-forget tap-through signal. Never block navigation on it. */
  async markActed(id: string): Promise<void> {
    await apiClient.post(`/ai/recommendations/${id}/acted`, {});
  },
};
