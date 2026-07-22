// backend/src/domains/AIAgentDomain/services/recommendations/registry.ts
//
// The detector registry. Adding a detector is an append here plus one file in
// ./detectors — the generator loop is detector-agnostic, exactly like
// METRIC_DEFINITIONS in the anomaly engine.

import { RecommendationDetector } from './types';
import { lapsedCustomersDetector } from './detectors/lapsedCustomers';
import { lowStockDetector } from './detectors/lowStock';
import { slowPeriodDetector } from './detectors/slowPeriod';
import { reorderNeededDetector } from './detectors/reorderNeeded';
import { deadStockDetector } from './detectors/deadStock';
import { reviewRequestsDetector } from './detectors/reviewRequests';
import { unansweredLeadsDetector } from './detectors/unansweredLeads';

export const RECOMMENDATION_DETECTORS: RecommendationDetector[] = [
  // presentation: 'card' — the "AI Recommendations for You" list
  lapsedCustomersDetector,
  lowStockDetector,
  slowPeriodDetector,
  reorderNeededDetector,
  deadStockDetector,
  // presentation: 'action' — the "Priority Actions" grid
  reviewRequestsDetector,
  unansweredLeadsDetector,
];

export function getDetectorByKey(
  key: string
): RecommendationDetector | undefined {
  return RECOMMENDATION_DETECTORS.find((d) => d.key === key);
}
