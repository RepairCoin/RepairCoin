// backend/src/domains/AdsDomain/services/LeadAttributionService.ts
//
// STAGE 2 STUB. Determines the campaign/creative for an inbound lead from its
// source data (UTM params, click IDs, Meta webhook payload), applies phone-based
// dedupe, and links lead → customer on conversion. Stage 0 ships only the manual
// path (LeadController writes attribution_method='manual' directly), so this
// service is a signature placeholder until Stage 2.
// See docs/tasks/strategy/ads-system/ (§Stage 2).

import { AttributionMethod } from '../repositories/LeadRepository';

export interface RawLead {
  campaignId?: string;
  creativeId?: string;
  name?: string;
  phone?: string;
  email?: string;
  utm?: Record<string, string>;
  clickId?: string;
  method: AttributionMethod;
}

export class LeadAttributionService {
  /** Resolve campaign/creative + dedupe, then persist the lead. Returns lead id. */
  async attribute(_raw: RawLead): Promise<string> {
    throw new Error('LeadAttributionService.attribute not implemented — Stage 2');
  }
}
