/**
 * Mirrors the backend's RecommendationDto
 * (backend/src/domains/AIAgentDomain/services/recommendations/types.ts) and the
 * web client (frontend/src/services/api/aiRecommendations.ts). Keep the three in sync.
 */

export type RecCategory =
  | "revenue"
  | "customers"
  | "marketing"
  | "inventory"
  | "operations";

export type RecSeverity = "low" | "medium" | "high";

/** Which dashboard surface renders this: the recommendations list, or Priority Actions. */
export type RecPresentation = "card" | "action";

/** Typed destination for a card tap. */
export type RecAction =
  | { kind: "navigate"; tab: string; sub?: string }
  | { kind: "assistant"; prompt: string }
  | { kind: "campaign"; audience: string }
  | { kind: "workflow"; templateId: string };

export interface Recommendation {
  id: string;
  detectorKey: string;
  category: RecCategory;
  severity: RecSeverity;
  title: string;
  description: string;
  action: RecAction;
  assistantPrompt: string | null;
  /** The numbers behind the copy — every figure in title/description comes from here. */
  evidence: Record<string, number | string>;
  presentation: RecPresentation;
  /** Button text for a Priority Action tile ("Contact Leads"). Null for cards. */
  ctaLabel: string | null;
  detectedAt: string;
}

export interface RecommendationsData {
  recommendations: Recommendation[];
  /** How many active cards this shop's tier hides. */
  gatedCount: number;
}

export interface RecommendationsResponse {
  success: boolean;
  data: RecommendationsData;
}
