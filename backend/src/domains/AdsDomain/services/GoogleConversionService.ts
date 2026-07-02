// backend/src/domains/AdsDomain/services/GoogleConversionService.ts
//
// Google conversion-optimization, Phase 2 — report a converted lead back to Google as an offline
// click conversion (keyed by the gclid captured in Phase 1), so Google can measure conversions and
// (Phase 3) bid toward them. Called best-effort from the lead→order attribution path when a lead
// reaches 'paid'. Idempotent per lead. Gated by ADS_GOOGLE_PUSH_ENABLED + a configured Google app.

import { logger } from '../../../utils/logger';
import { googleAdsService } from './GoogleAdsService';
import { decryptToken } from '../../../utils/tokenCrypto';
import { GoogleConnectionRepository } from '../repositories/GoogleConnectionRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { LeadRepository } from '../repositories/LeadRepository';

/** Format a Date as Google's required conversion datetime: "yyyy-MM-dd HH:mm:ss+00:00" (UTC). */
export function fmtGoogleConversionDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
}

export class GoogleConversionService {
  constructor(
    private readonly connections = new GoogleConnectionRepository(),
    private readonly campaigns = new CampaignRepository(),
    private readonly leads = new LeadRepository()
  ) {}

  enabled(): boolean {
    return process.env.ADS_GOOGLE_PUSH_ENABLED === 'true' && googleAdsService.isConfigured();
  }

  /** Upload the lead's offline conversion to Google. No-op (returns false) when disabled, the lead
   *  has no gclid, it was already uploaded, or the campaign isn't a Google one. Non-throwing —
   *  never affects the order/attribution flow. Returns true when a conversion was uploaded. */
  async uploadLeadConversion(leadId: string, at: Date = new Date()): Promise<boolean> {
    if (!this.enabled()) return false;
    try {
      const lead = await this.leads.findById(leadId);
      if (!lead?.gclid || lead.conversionUploadedAt) return false; // nothing to upload / already done

      const campaign = await this.campaigns.findById(lead.campaignId);
      if (!campaign?.googleCampaignId) return false; // not a Google campaign

      const conn = await this.connections.getConnection(campaign.shopId);
      if (!conn?.refreshTokenEnc || !conn.customerId) return false; // disconnected
      const token = decryptToken(conn.refreshTokenEnc);
      const login = conn.managerId ?? undefined;

      // Resolve the conversion action once per shop (create on first use), then cache it.
      let actionRes = await this.connections.getConversionAction(campaign.shopId);
      if (!actionRes) {
        actionRes = await googleAdsService.ensureLeadConversionAction(conn.customerId, token, login);
        await this.connections.saveConversionAction(campaign.shopId, actionRes);
      }

      await googleAdsService.uploadClickConversion(
        conn.customerId, token,
        { gclid: lead.gclid, conversionActionResourceName: actionRes, conversionDateTime: fmtGoogleConversionDateTime(at) },
        login
      );
      await this.leads.markConversionUploaded(leadId);
      logger.info('GoogleConversionService: uploaded offline conversion', { leadId, campaignId: lead.campaignId });
      return true;
    } catch (err: any) {
      logger.error('GoogleConversionService.uploadLeadConversion failed (non-fatal)', { leadId, error: err?.message || err });
      return false;
    }
  }
}

export const googleConversionService = new GoogleConversionService();
