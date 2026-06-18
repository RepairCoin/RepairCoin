// backend/src/domains/AdsDomain/services/MetaPushService.ts
//
// Stage-4 PUSH orchestration (Phase 1). On Build, create the real Campaign + Ad Set on the
// shop's connected Meta ad account — PAUSED (Option B: admin reviews + goes live later). The
// ad + creative come in Phase 2; insights in Phase 3; go-live/status in Phase 4/5. Gated by
// ADS_META_PUSH_ENABLED + a configured Meta App; until on, Build stays record-only (no regression).

import { logger } from '../../../utils/logger';
import { metaService } from './MetaService';
import { buildCampaignSpec } from './metaTargeting';
import { adCreativeService, AdCreativeService } from './AdCreativeService';
import { decryptToken } from '../../../utils/tokenCrypto';
import { MetaConnectionRepository } from '../repositories/MetaConnectionRepository';
import { CampaignRepository, AdCampaign } from '../repositories/CampaignRepository';
import { AdCampaignRequest } from '../repositories/CampaignRequestRepository';

export class MetaPushService {
  constructor(
    private readonly connections = new MetaConnectionRepository(),
    private readonly campaigns = new CampaignRepository(),
    private readonly creatives: AdCreativeService = adCreativeService
  ) {}

  /** Push is live only when the flag is on AND a Meta App is configured. */
  enabled(): boolean {
    return process.env.ADS_META_PUSH_ENABLED === 'true' && metaService.isConfigured();
  }

  /** Create PAUSED Campaign + Ad Set on the shop's ad account; persist ids on our campaign.
   *  Throws (with rollback of any created Meta objects) on failure — caller maps to 502. */
  async pushNewCampaign(shopId: string, request: AdCampaignRequest, campaign: AdCampaign): Promise<void> {
    const conn = await this.connections.getConnection(shopId);
    if (!conn?.userTokenEnc || !conn.adAccountId || !conn.pageId) {
      throw new Error('meta_not_connected: shop must connect its Meta ad account + Page first');
    }
    const token = decryptToken(conn.userTokenEnc);

    // Account must be active. (Funding source is verified at GO-LIVE — Phase 5 — since a
    // PAUSED draft never spends; this lets dev/test ad accounts build objects.)
    const status = await metaService.getAccountStatus(conn.adAccountId, token);
    if (status.accountStatus !== 1) throw new Error('ad_account_not_active: the shop\'s Meta ad account is not active');

    const geo = await this.connections.getShopGeo(shopId);
    const spec = buildCampaignSpec({
      goal: request.goal,
      monthlyBudgetCents: request.monthlyBudgetCents,
      targetRadiusMiles: request.targetRadiusMiles,
      lat: geo.lat,
      lng: geo.lng,
    });

    let metaCampaignId: string | undefined;
    let metaAdSetId: string | undefined;
    let metaCreativeId: string | undefined;
    let metaAdId: string | undefined;
    try {
      metaCampaignId = await metaService.createCampaign(conn.adAccountId, token, {
        name: campaign.name, objective: spec.objective,
      });
      metaAdSetId = await metaService.createAdSet(conn.adAccountId, token, {
        name: `${campaign.name} — ad set`,
        campaignId: metaCampaignId,
        dailyBudgetCents: spec.dailyBudgetCents,
        optimizationGoal: spec.optimizationGoal,
        billingEvent: spec.billingEvent,
        targeting: spec.targeting,
        promotedPageId: conn.pageId,
      });
      // Phase 2 — auto-creative (AI image + copy) → creative → ad.
      const creative = await this.creatives.build(shopId, request, campaign.name);
      // Phase 4 — for lead objectives, attach a native instant form (best-effort; falls back
      // to the link creative if the form can't be created). Leads arrive via the webhook.
      let metaLeadFormId: string | undefined;
      if (spec.objective === 'OUTCOME_LEADS' && conn.pageTokenEnc) {
        try {
          const pageToken = decryptToken(conn.pageTokenEnc);
          metaLeadFormId = await metaService.ensureLeadForm(conn.pageId, pageToken, {
            name: `${campaign.name} — leads`,
            privacyPolicyUrl: creative.linkUrl,
          });
        } catch (e: any) {
          logger.warn(`MetaPushService: lead form creation failed, using link creative — ${e?.message || e}`);
        }
      }
      metaCreativeId = await metaService.createAdCreative(conn.adAccountId, token, {
        pageId: conn.pageId,
        imageUrl: creative.imageUrl,
        headline: creative.headline,
        message: creative.primaryText,
        linkUrl: creative.linkUrl,
        leadFormId: metaLeadFormId,
      });
      metaAdId = await metaService.createAd(conn.adAccountId, token, {
        name: `${campaign.name} — ad`,
        adsetId: metaAdSetId,
        creativeId: metaCreativeId,
      });
      await this.campaigns.setMetaObjects(campaign.id, {
        metaCampaignId, metaAdSetId, metaCreativeId, metaAdId, metaStatus: 'PAUSED',
        metaLeadFormId: metaLeadFormId ?? null,
      });
      logger.info(`MetaPushService: created PAUSED campaign ${metaCampaignId} (adset ${metaAdSetId}, ad ${metaAdId}) for shop ${shopId}`);
    } catch (err) {
      // Roll back any Meta objects we created so there are no orphans (child → parent).
      if (metaAdId) await metaService.deleteObject(metaAdId, token);
      if (metaCreativeId) await metaService.deleteObject(metaCreativeId, token);
      if (metaAdSetId) await metaService.deleteObject(metaAdSetId, token);
      if (metaCampaignId) await metaService.deleteObject(metaCampaignId, token);
      throw err;
    }
  }

  /** Push a status change (ACTIVE|PAUSED) to the campaign's Meta objects. Used by go-live,
   *  admin/shop pause/activate, and the safeguard auto-pause. Returns false when there's
   *  nothing to push (not enabled / not pushed / disconnected). Throws on a Graph error so
   *  go-live can surface it; best-effort callers (pause) should catch. */
  async pushStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<boolean> {
    if (!this.enabled()) return false;
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign?.metaCampaignId) return false;
    const conn = await this.connections.getConnection(campaign.shopId);
    if (!conn?.userTokenEnc) return false;
    const token = decryptToken(conn.userTokenEnc);
    const ids = [campaign.metaCampaignId, campaign.metaAdSetId, campaign.metaAdId].filter(Boolean) as string[];
    for (const id of ids) await metaService.setObjectStatus(id, status, token);
    await this.campaigns.setMetaObjects(campaignId, { metaStatus: status });
    return true;
  }

  /** Go live (Option B): verify a funding source (real spend starts now — §3.1 deferred from
   *  P1), then activate the campaign/adset/ad on Meta. Throws a descriptive error for the UI. */
  async goLive(campaignId: string): Promise<void> {
    if (!this.enabled()) throw new Error('push_disabled');
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign?.metaCampaignId) throw new Error('not_a_meta_draft');
    const conn = await this.connections.getConnection(campaign.shopId);
    if (!conn?.userTokenEnc || !conn.adAccountId) throw new Error('meta_not_connected');
    const token = decryptToken(conn.userTokenEnc);
    const status = await metaService.getAccountStatus(conn.adAccountId, token);
    if (status.accountStatus !== 1) throw new Error('ad_account_not_active');
    if (!status.hasFunding) throw new Error('no_funding_source: add a payment method to the shop\'s Meta ad account before going live');
    const ids = [campaign.metaCampaignId, campaign.metaAdSetId, campaign.metaAdId].filter(Boolean) as string[];
    for (const id of ids) await metaService.setObjectStatus(id, 'ACTIVE', token);
    await this.campaigns.setMetaObjects(campaignId, { metaStatus: 'ACTIVE' });
  }

  /** In-app draft edits (Phase 5 Level 2): budget / radius (ad set) and headline / primaryText /
   *  image (a new creative, since Meta creatives are immutable). Persists budget/radius locally. */
  async updateDraft(campaignId: string, edits: {
    dailyBudgetCents?: number; radiusMiles?: number;
    headline?: string; primaryText?: string; regenerateImage?: boolean;
    request?: AdCampaignRequest;
  }): Promise<void> {
    if (!this.enabled()) throw new Error('push_disabled');
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign?.metaCampaignId) throw new Error('not_a_meta_draft');
    const conn = await this.connections.getConnection(campaign.shopId);
    if (!conn?.userTokenEnc || !conn.adAccountId || !conn.pageId) throw new Error('meta_not_connected');
    const token = decryptToken(conn.userTokenEnc);

    // 1) Ad set — budget + radius (rebuild the geo targeting around the new radius).
    const adsetEdit: { dailyBudgetCents?: number; targeting?: Record<string, any> } = {};
    if (edits.dailyBudgetCents != null) adsetEdit.dailyBudgetCents = edits.dailyBudgetCents;
    if (edits.radiusMiles != null) {
      const geo = await this.connections.getShopGeo(campaign.shopId);
      adsetEdit.targeting = buildCampaignSpec({
        goal: edits.request?.goal ?? null, monthlyBudgetCents: null, targetRadiusMiles: edits.radiusMiles, lat: geo.lat, lng: geo.lng,
      }).targeting;
    }
    if (campaign.metaAdSetId && (adsetEdit.dailyBudgetCents != null || adsetEdit.targeting)) {
      await metaService.updateAdSet(campaign.metaAdSetId, token, adsetEdit);
    }
    const dbUpdate: Record<string, any> = {};
    if (edits.dailyBudgetCents != null) dbUpdate.dailyBudgetCents = edits.dailyBudgetCents;
    if (edits.radiusMiles != null) dbUpdate.targetRadiusMiles = edits.radiusMiles;
    if (Object.keys(dbUpdate).length) await this.campaigns.update(campaignId, dbUpdate);

    // 2) Creative — text and/or image edit → build a NEW creative → point the ad at it.
    const wantsCreativeEdit = !!(edits.headline || edits.primaryText || edits.regenerateImage);
    if (wantsCreativeEdit && campaign.metaAdId && edits.request) {
      let imageUrl: string;
      let headline: string;
      let primaryText: string;
      let linkUrl: string;
      if (edits.regenerateImage) {
        const fresh = await this.creatives.build(campaign.shopId, edits.request, campaign.name);
        imageUrl = fresh.imageUrl; headline = edits.headline || fresh.headline; primaryText = edits.primaryText || fresh.primaryText; linkUrl = fresh.linkUrl;
      } else {
        // Keep the current image; merge text edits over the existing creative.
        const cur = campaign.metaCreativeId ? await metaService.getCreativeSpec(campaign.metaCreativeId, token) : null;
        if (!cur?.picture) throw new Error('creative_unavailable_for_text_edit');
        imageUrl = cur.picture; headline = edits.headline || cur.headline; primaryText = edits.primaryText || cur.message; linkUrl = cur.link;
      }
      const oldCreativeId = campaign.metaCreativeId;
      const newCreativeId = await metaService.createAdCreative(conn.adAccountId, token, {
        pageId: conn.pageId, imageUrl, headline, message: primaryText, linkUrl,
        leadFormId: campaign.metaLeadFormId ?? undefined,
      });
      await metaService.updateAdCreative(campaign.metaAdId, token, newCreativeId);
      await this.campaigns.setMetaObjects(campaignId, { metaCreativeId: newCreativeId });
      if (oldCreativeId) await metaService.deleteObject(oldCreativeId, token); // best-effort cleanup
    }
  }
}

export const metaPushService = new MetaPushService();
