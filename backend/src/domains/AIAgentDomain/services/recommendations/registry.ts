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
import { noRecentCampaignDetector } from './detectors/noRecentCampaign';
import { unansweredMessagesDetector } from './detectors/unansweredMessages';

export const RECOMMENDATION_DETECTORS: RecommendationDetector[] = [
  // presentation: 'card' — the "AI Recommendations for You" list
  lapsedCustomersDetector, //    customers
  lowStockDetector, //           inventory
  slowPeriodDetector, //         revenue
  reorderNeededDetector, //      inventory
  deadStockDetector, //          inventory
  noRecentCampaignDetector, //   marketing
  // presentation: 'action' — the "Priority Actions" grid
  reviewRequestsDetector, //     customers
  // both surfaces (see the notes in the detectors) — the `operations` sources.
  // unanswered_messages is the UNIVERSAL one; unanswered_leads only applies to
  // shops that pay for the Ads add-on (2 of 65 today), so it can't carry the
  // category on its own. Kept as separate cards — a paid lead and a customer
  // conversation are different work and go to different screens.
  unansweredLeadsDetector, //    operations (Ads add-on only)
  unansweredMessagesDetector, // operations (every shop)
];

export function getDetectorByKey(
  key: string
): RecommendationDetector | undefined {
  return RECOMMENDATION_DETECTORS.find((d) => d.key === key);
}
