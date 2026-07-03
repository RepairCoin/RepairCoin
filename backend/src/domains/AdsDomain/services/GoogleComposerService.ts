// backend/src/domains/AdsDomain/services/GoogleComposerService.ts
//
// In-dashboard editing of a Google Search draft — budget, RSA copy (headlines/descriptions) and
// keywords — pushed to Google on save. The Google analog of MetaPushService.updateDraft. Only the
// parts that changed are pushed. RSA ads are immutable, so a copy edit recreates the ad. Gated by
// ADS_GOOGLE_PUSH_ENABLED. See docs/tasks/strategy/ads-system/ads-google-composer-scope.md.

import { logger } from '../../../utils/logger';
import { googleAdsService, validateRsaContent } from './GoogleAdsService';
import { decryptToken } from '../../../utils/tokenCrypto';
import { GoogleConnectionRepository } from '../repositories/GoogleConnectionRepository';
import { CampaignRepository, AdCampaign, GoogleAdContent } from '../repositories/CampaignRepository';

export interface GoogleDraftEdits {
  dailyBudgetCents?: number;
  headlines?: string[];
  descriptions?: string[];
  keywords?: string[];
}

export class GoogleComposerService {
  constructor(
    private readonly connections = new GoogleConnectionRepository(),
    private readonly campaigns = new CampaignRepository()
  ) {}

  enabled(): boolean {
    return process.env.ADS_GOOGLE_PUSH_ENABLED === 'true' && googleAdsService.isConfigured();
  }

  /** Populate/backfill: return the campaign with its Google ad content. When the content is empty
   *  (built before the composer, or first open) or forceRefresh is set, read the current RSA copy +
   *  keywords FROM Google and store them, so the composer shows the real AI-generated content. Never
   *  throws — returns the campaign as-is when disabled / not-google / disconnected / on read error. */
  async getDraftContent(campaignId: string, forceRefresh = false): Promise<AdCampaign | null> {
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign?.googleCampaignId || !campaign.googleAdGroupId) return campaign;
    const hasContent = !!(campaign.googleAdContent && campaign.googleAdContent.headlines?.length);
    if (hasContent && !forceRefresh) return campaign;
    if (!this.enabled()) return campaign;
    try {
      const conn = await this.connections.getConnection(campaign.shopId);
      if (!conn?.refreshTokenEnc || !conn.customerId) return campaign;
      const token = decryptToken(conn.refreshTokenEnc);
      const fetched = await googleAdsService.fetchAdContent(conn.customerId, token, campaign.googleAdGroupId, conn.managerId ?? undefined);
      if (!fetched.headlines.length && !fetched.keywords.length) return campaign; // nothing to store
      await this.campaigns.setGoogleObjects(campaignId, {
        googleAdContent: { headlines: fetched.headlines, descriptions: fetched.descriptions, keywords: fetched.keywords, finalUrl: fetched.finalUrl },
        ...(fetched.adId ? { googleAdId: fetched.adId } : {}),
      });
      logger.info('GoogleComposerService: backfilled ad content from Google', { campaignId });
      return this.campaigns.findById(campaignId);
    } catch (err: any) {
      logger.warn('GoogleComposerService.getDraftContent read failed (non-fatal)', { campaignId, error: err?.message || err });
      return campaign;
    }
  }

  /** Apply edits to a pushed Google draft: push only the changed parts to Google, persist the copy
   *  locally. Throws a descriptive error for the UI. Returns the fresh campaign. */
  async updateDraft(campaignId: string, edits: GoogleDraftEdits): Promise<AdCampaign | null> {
    if (!this.enabled()) throw new Error('push_disabled');
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign?.googleCampaignId || !campaign.googleAdGroupId) throw new Error('not_a_google_draft');
    if (campaign.status === 'archived') throw new Error('campaign_archived_on_google: this campaign was archived or removed; it can’t be edited');

    const conn = await this.connections.getConnection(campaign.shopId);
    if (!conn?.refreshTokenEnc || !conn.customerId) throw new Error('google_not_connected');
    const token = decryptToken(conn.refreshTokenEnc);
    const login = conn.managerId ?? undefined;
    const customerId = conn.customerId;
    const adGroupResourceName = `customers/${customerId}/adGroups/${campaign.googleAdGroupId}`;

    const content: GoogleAdContent = campaign.googleAdContent ?? { headlines: [], descriptions: [], keywords: [], finalUrl: null };
    const next: GoogleAdContent = { ...content };

    // 1) Budget.
    if (edits.dailyBudgetCents != null && edits.dailyBudgetCents !== campaign.dailyBudgetCents) {
      if (!campaign.googleBudgetId) throw new Error('missing_budget_id');
      await googleAdsService.updateCampaignBudget(customerId, token, campaign.googleBudgetId, edits.dailyBudgetCents * 10000, login);
      await this.campaigns.update(campaignId, { dailyBudgetCents: edits.dailyBudgetCents });
    }

    // 2) RSA copy (headlines / descriptions) — immutable, so recreate the ad.
    if (edits.headlines !== undefined || edits.descriptions !== undefined) {
      const v = validateRsaContent(edits.headlines ?? content.headlines, edits.descriptions ?? content.descriptions);
      if ('error' in v) throw new Error(`invalid_rsa: ${v.error}`);
      const finalUrl = content.finalUrl || `${(process.env.ADS_LANDING_BASE_URL || process.env.FRONTEND_URL || 'https://staging.repaircoin.ai').replace(/\/$/, '')}/l/${campaignId}`;
      const oldAd = campaign.googleAdId ? `customers/${customerId}/adGroupAds/${campaign.googleAdId}` : null;
      const res = await googleAdsService.replaceResponsiveSearchAd(customerId, token, adGroupResourceName, oldAd, { headlines: v.headlines, descriptions: v.descriptions, finalUrl }, login);
      next.headlines = v.headlines; next.descriptions = v.descriptions; next.finalUrl = finalUrl;
      await this.campaigns.setGoogleObjects(campaignId, { googleAdId: res.adResourceName.split('/').pop() });
    }

    // 3) Keywords.
    if (edits.keywords !== undefined) {
      const res = await googleAdsService.reconcileKeywords(customerId, token, campaign.googleAdGroupId, adGroupResourceName, edits.keywords, login);
      next.keywords = res.keywords;
    }

    await this.campaigns.setGoogleObjects(campaignId, { googleAdContent: next });
    logger.info('GoogleComposerService: updated Google draft', { campaignId, changed: Object.keys(edits) });
    return this.campaigns.findById(campaignId);
  }
}

export const googleComposerService = new GoogleComposerService();
