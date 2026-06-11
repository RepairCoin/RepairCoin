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

export interface RawLead {
  campaignId?: string;
  creativeId?: string;
  name?: string;
  phone?: string;
  email?: string;
  utm?: Record<string, string>;
  clickId?: string;
  consentToContact?: boolean;
  method: AttributionMethod;
}

export interface AttributeResult {
  leadId: string;
  deduped: boolean;
}

/** Crude E.164 normalization (pure) — strips formatting; assumes US (+1) for a
 *  bare 10-digit number. Good enough for dedupe; full libphonenumber is overkill. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;
  if (cleaned.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  return '+' + digits;
}

export class LeadAttributionService {
  constructor(private readonly leads = new LeadRepository()) {}

  async attribute(raw: RawLead): Promise<AttributeResult> {
    const campaignId = raw.campaignId || raw.utm?.utm_campaign;
    if (!campaignId) throw new Error('Cannot attribute lead: no campaign id (explicit or utm_campaign)');
    const creativeId = raw.creativeId || raw.utm?.utm_content || null;
    const phone = normalizePhone(raw.phone);

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
    });

    await eventBus.publish(
      createDomainEvent(
        AdsEvents.LEAD_CAPTURED,
        lead.id,
        { campaignId, creativeId, method: raw.method },
        'AdsDomain'
      )
    );
    return { leadId: lead.id, deduped: false };
  }
}

export const leadAttributionService = new LeadAttributionService();
