// backend/tests/services/AdsGoogleBidding.test.ts
//
// Google conversion-optimization Phase 3 — the pure bidding-strategy selection used by
// createSearchCampaign. Conversion-optimized (Maximize Conversions) when opted in via
// ADS_GOOGLE_OPTIMIZE_FOR_LEAD, else manual CPC (clicks). The live campaign create is externally
// gated; this locks the mapping.

import { campaignBiddingSpec } from '../../src/domains/AdsDomain/services/GoogleAdsService';

describe('campaignBiddingSpec (pure)', () => {
  it('uses Maximize Conversions when optimizing for conversions', () => {
    expect(campaignBiddingSpec(true)).toEqual({ maximizeConversions: {} });
  });
  it('uses manual CPC (clicks) otherwise', () => {
    expect(campaignBiddingSpec(false)).toEqual({ manualCpc: {} });
  });
});
