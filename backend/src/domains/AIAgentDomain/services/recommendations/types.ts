// backend/src/domains/AIAgentDomain/services/recommendations/types.ts
//
// P0 — shared types for the dashboard recommendation feed.
// Scope: docs/tasks/strategy/ai-recommendations/scope.md
//
// Deliberately mirrors the Phase 7.2 anomaly split: detection is pure SQL and
// produces auditable candidates; ranking/gating is pure; only phrasing may ever
// involve Claude (P4). Keeping the layers apart means the flag list is testable
// on its own and tuning thresholds costs no AI budget.

import { Pool } from 'pg';

export type RecCategory =
  | 'revenue'
  | 'customers'
  | 'marketing'
  | 'inventory'
  | 'operations';

export type RecSeverity = 'low' | 'medium' | 'high';

/** Typed destination for a card tap. */
export type RecAction =
  /** Deep-link a dashboard tab — used when the answer is a screen the shop
   *  already has (e.g. the inventory table IS the answer to "what's low?"). */
  | { kind: 'navigate'; tab: string; sub?: string }
  /** Open the unified assistant with `prompt` prefilled — used when the answer
   *  is judgement ("draft a promo", "why did revenue drop"). */
  | { kind: 'assistant'; prompt: string }
  /** Open AI Campaigns prefilled with an audience. */
  | { kind: 'campaign'; audience: string };

/**
 * What a detector emits. Pure data — no copy, no ranking, no tier logic.
 *
 * `evidence` is the contract that keeps the feed honest: the title/description
 * templates and `assistantPrompt` may only interpolate values from here, so a
 * card can never state a number nothing computed.
 */
export interface RecCandidate {
  detectorKey: string;
  category: RecCategory;
  severity: RecSeverity;
  evidence: Record<string, number | string>;
  action: RecAction;
  /** Secondary "ask AI about this" tap. Templated from `evidence` — never
   *  AI-generated (that would cost a Claude call to write a string we can
   *  interpolate, and could only lose precision the detector already has). */
  assistantPrompt: string;
  title: string;
  description: string;
}

/**
 * A detector answers one question about one shop with pure SQL.
 *
 * Contract:
 *  - MUST apply its own minimum-signal floor and return [] below it. A feed
 *    that fires on one lapsed customer is worse than no feed — see
 *    AnomalyDetector's MIN_SIGNAL for the precedent.
 *  - MUST NOT call Claude.
 *  - MUST NOT consider tier; the service filters on `requiredFeature`.
 */
export interface RecommendationDetector {
  key: string;
  category: RecCategory;
  /** featureTiers key the shop needs to ACT on this. Undefined = no extra gate
   *  beyond the feed's own. */
  requiredFeature?: string;
  detect(pool: Pool, shopId: string): Promise<RecCandidate[]>;
}

/** Row shape returned to the dashboard. */
export interface RecommendationDto {
  id: string;
  detectorKey: string;
  category: RecCategory;
  severity: RecSeverity;
  title: string;
  description: string;
  action: RecAction;
  assistantPrompt: string | null;
  evidence: Record<string, number | string>;
  detectedAt: string;
}
