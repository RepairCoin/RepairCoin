// backend/src/domains/AIAgentDomain/services/recommendations/registry.ts
//
// P0 — the detector registry. Empty by design: P0 ships the pipeline, P1 adds
// the first three detectors (lapsed_customers, low_stock, slow_period).
//
// Adding a detector is an append here plus one file in ./detectors — the
// generator loop is detector-agnostic, exactly like METRIC_DEFINITIONS in the
// anomaly engine.

import { RecommendationDetector } from './types';

export const RECOMMENDATION_DETECTORS: RecommendationDetector[] = [
  // P1: lapsedCustomersDetector, lowStockDetector, slowPeriodDetector
];

export function getDetectorByKey(
  key: string
): RecommendationDetector | undefined {
  return RECOMMENDATION_DETECTORS.find((d) => d.key === key);
}
