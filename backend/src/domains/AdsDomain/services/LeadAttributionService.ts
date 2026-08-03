// backend/src/domains/AdsDomain/services/LeadAttributionService.ts
//
// Stage 2 — lead intake + attribution. Resolves the campaign/creative from the
// raw lead (explicit IDs or UTM params), dedupes by phone (same campaign, 24h),
// persists, and fires ads:lead_captured. The manual path (admin) and the public
// webform path both flow through attribute(). `normalizePhone` is pure (tested).

import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { AdsEvents } from '../events';
import { LeadRepository, AttributionMethod } from '../repositories/LeadRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
// normalizePhone now lives in the shared phone util (SMS needs it too); re-exported here so existing
// imports (and tests) that pull it from this module keep working.
export { normalizePhone } from '../../../utils/phone';
import { normalizePhone } from '../../../utils/phone';

export interface RawLead {
  campaignId?: string;
  creativeId?: string;
  name?: string;
  phone?: string;
  email?: string;
  utm?: Record<string, string>;
  clickId?: string;
  /** Google click id specifically (for offline conversion upload); distinct from clickId, which
   *  may be an fbclid. */
  gclid?: string;
  /** Facebook click id (auto-appended on FB ad-click landing URLs) — attributes to Facebook. */
  fbclid?: string;
  consentToContact?: boolean;
  metaLeadId?: string;
  method: AttributionMethod;
}

export interface AttributeResult {
  leadId: string;
  deduped: boolean;
}

export class LeadAttributionService {
  constructor(
    private readonly leads = new LeadRepository(),
    // Only needed to resolve the shop behind a lead — `ad_leads` has no shop_id of its own, so it has
    // to come from campaign_id → ad_campaigns.shop_id.
    private readonly campaigns = new CampaignRepository()
  ) {}

  async attribute(raw: RawLead): Promise<AttributeResult> {
    const campaignId = raw.campaignId || raw.utm?.utm_campaign;
    if (!campaignId) throw new Error('Cannot attribute lead: no campaign id (explicit or utm_campaign)');
    const creativeId = raw.creativeId || raw.utm?.utm_content || null;
    const phone = normalizePhone(raw.phone);

    // Idempotency: Meta re-delivers webhooks — a known meta_lead_id is a no-op.
    if (raw.metaLeadId) {
      const existingMeta = await this.leads.findByMetaLeadId(raw.metaLeadId);
      if (existingMeta) return { leadId: existingMeta, deduped: true };
    }

    // Dedupe: a recent non-duplicate lead with the same phone on this campaign.
    if (phone) {
      const existing = await this.leads.findRecentByPhone(campaignId, phone, 24);
      if (existing) {
        logger.info(`LeadAttributionService: deduped lead (phone match) → ${existing}`);
        return { leadId: existing, deduped: true };
      }
    }

    const lead = await this.leads.create({
      campaignId,
      creativeId,
      name: raw.name ?? null,
      phone: phone ?? raw.phone ?? null,
      email: raw.email ?? null,
      attributionMethod: raw.method,
      consentToContact: raw.consentToContact ?? false,
      metaLeadId: raw.metaLeadId ?? null,
      gclid: raw.gclid ?? null,
      fbclid: raw.fbclid ?? null,
    });

    // shopId is added ADDITIVELY — existing subscribers keep the payload they already read, and
    // Custom Workflows gets the one field it cannot work without: automations are keyed on shopId, and
    // a lead has no shop of its own (ad_leads stores only campaign_id). Resolved best-effort, because
    // failing to look up a campaign must not stop a captured lead from being recorded.
    let shopId: string | null = null;
    try {
      shopId = (await this.campaigns.findById(campaignId))?.shopId ?? null;
    } catch {
      shopId = null;
    }

    await eventBus.publish(
      createDomainEvent(
        AdsEvents.LEAD_CAPTURED,
        lead.id,
        { campaignId, creativeId, method: raw.method, shopId },
        'AdsDomain'
      )
    );
    return { leadId: lead.id, deduped: false };
  }
}

export const leadAttributionService = new LeadAttributionService();
