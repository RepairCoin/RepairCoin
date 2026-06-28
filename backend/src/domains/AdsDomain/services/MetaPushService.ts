// backend/src/domains/AdsDomain/services/MetaPushService.ts
//
// Stage-4 PUSH orchestration. The flow is PREPARE → PUSH → GO-LIVE so the admin reviews
// everything BEFORE anything reaches Meta:
//   1) prepareCreative  — generate the AI image + copy LOCALLY (no Meta call), stored as a
//      'pending' ad_creatives row. The campaign stays a local 'draft'.
//   2) pushPreparedCampaign — validate (account active, currency-aware budget minimum) then
//      create the PAUSED Campaign/AdSet/Creative/Ad from the APPROVED reviewed config.
//   3) goLive — verify funding + activate (real spend starts here).
// Gated by ADS_META_PUSH_ENABLED + a configured Meta App; until on, Build stays record-only.

import { logger } from '../../../utils/logger';
import { metaService } from './MetaService';
import { metaConfigSyncService } from './MetaConfigSyncService';
import { buildCampaignSpec, asMetaObjective } from './metaTargeting';
import { adCreativeService, AdCreativeService, publicUrl } from './AdCreativeService';
import { decryptToken } from '../../../utils/tokenCrypto';
import { MetaConnectionRepository } from '../repositories/MetaConnectionRepository';
import { CampaignRepository, AdCampaign } from '../repositories/CampaignRepository';
import { AdCampaignRequest } from '../repositories/CampaignRequestRepository';
import { CreativeRepository } from '../repositories/CreativeRepository';

/** Our public campaign landing page URL (the ad's click target). Uses ADS_LANDING_BASE_URL
 *  (the deployed public frontend) or FRONTEND_URL. Returns undefined when no base is set;
 *  AdCreativeService rejects localhost, so dev falls back to the shop website automatically. */
function landingUrlFor(campaignId: string): string | undefined {
  const base = (process.env.ADS_LANDING_BASE_URL || process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  return base ? `${base}/l/${campaignId}?utm_campaign=${encodeURIComponent(campaignId)}` : undefined;
}

export class MetaPushService {
  constructor(
    private readonly connections = new MetaConnectionRepository(),
    private readonly campaigns = new CampaignRepository(),
    private readonly creatives: AdCreativeService = adCreativeService,
    private readonly creativeRepo = new CreativeRepository()
  ) {}

  /** Push is live only when the flag is on AND a Meta App is configured. */
  enabled(): boolean {
    return process.env.ADS_META_PUSH_ENABLED === 'true' && metaService.isConfigured();
  }

  /** Step 1 — generate the AI creative LOCALLY (image + copy) and store it as a 'pending'
   *  ad_creatives row for review. No Meta call. Used at Build (prepare) and on regenerate.
   *  Throws if the image can't be generated (e.g. ai_images_enabled off) so Build can surface it. */
  async prepareCreative(shopId: string, request: AdCampaignRequest, campaignId: string, campaignName: string, imagePrompt?: string): Promise<void> {
    const creative = await this.creatives.build(shopId, request, campaignName, { imagePrompt, landingUrl: landingUrlFor(campaignId), campaignId });
    await this.creativeRepo.upsertAi({
      campaignId, imageUrl: creative.imageUrl, headline: creative.headline,
      body: creative.primaryText, landingUrl: creative.linkUrl, generationPrompt: creative.imagePrompt,
    });
  }

  /** Step 2 — create the PAUSED Campaign/AdSet/Creative/Ad on the shop's ad account from the
   *  reviewed local draft + its APPROVED AI creative. Validates the budget against the account's
   *  currency minimum first (avoids Meta error 1885272). Rolls back any created Meta objects on
   *  failure. Throws a descriptive error — caller maps to 502. */
  async pushPreparedCampaign(shopId: string, request: AdCampaignRequest | null, campaign: AdCampaign): Promise<void> {
    if (!this.enabled()) throw new Error('push_disabled');
    if (campaign.metaCampaignId) throw new Error('already_pushed: this campaign is already on Meta');

    const conn = await this.connections.getConnection(shopId);
    if (!conn?.userTokenEnc || !conn.adAccountId || !conn.pageId) {
      throw new Error('meta_not_connected: shop must connect its Meta ad account + Page first');
    }
    const token = decryptToken(conn.userTokenEnc);

    // The AI creative must exist + be approved before we put anything on Meta.
    const creative = await this.creativeRepo.findAiByCampaign(campaign.id);
    if (!creative || !creative.imageUrl) throw new Error('no_creative: generate the ad creative first');
    if (creative.reviewStatus !== 'approved') {
      throw new Error('creative_not_approved: approve the ad creative in the Creatives panel before pushing to Meta');
    }

    // Account must be active. Budget must clear Meta's per-account minimum (currency-aware) —
    // the budget integer is read in the ACCOUNT's currency, so a USD-looking number can be too
    // low on a non-USD account (this is exactly error 1885272).
    const status = await metaService.getAccountStatus(conn.adAccountId, token);
    if (status.accountStatus !== 1) throw new Error('ad_account_not_active: the shop\'s Meta ad account is not active');
    if (status.minDailyBudget != null && campaign.dailyBudgetCents < status.minDailyBudget) {
      const cur = status.currency || '';
      const fmt = (cents: number) => (cents / 100).toFixed(2);
      throw new Error(`budget_below_minimum: daily budget must be at least ${fmt(status.minDailyBudget)} ${cur} on this ad account (you set ${fmt(campaign.dailyBudgetCents)} ${cur}).`);
    }

    const geo = await this.connections.getShopGeo(shopId);
    const spec = buildCampaignSpec({
      goal: request?.goal ?? null,
      objective: campaign.objective, // admin picker override (else derived from goal)
      monthlyBudgetCents: request?.monthlyBudgetCents ?? null,
      targetRadiusMiles: campaign.targetRadiusMiles,
      lat: geo.lat,
      lng: geo.lng,
      // Pixel "Lead" optimization (opt-in). Off by default — Meta under-delivers / rejects
      // OFFSITE_CONVERSIONS before the pixel has Lead events, so tracking ships first and ops
      // flips this on once events accrue. Only applies when the shop actually has a pixel.
      optimizeForPixelLead: process.env.ADS_OPTIMIZE_FOR_LEAD === 'true',
      pixelId: conn.pixelId,
    });
    // Use the REVIEWED daily budget on the campaign (not monthly/30) — the admin set it.
    const fullDaily = campaign.dailyBudgetCents || spec.dailyBudgetCents;
    // Safeguard 4 — test-budget tier: launch at a fraction of the full budget (floored at the
    // account minimum so it still delivers), and remember the full target to scale up to later.
    let dailyBudgetCents = fullDaily;
    if (campaign.isTestBudget) {
      const pct = parseFloat(process.env.ADS_TEST_BUDGET_PERCENT || '0.4');
      const floor = status.minDailyBudget ?? 100;
      dailyBudgetCents = Math.max(floor, Math.round(fullDaily * pct));
      await this.campaigns.update(campaign.id, { fullDailyBudgetCents: fullDaily });
    }
    const linkUrl = creative.landingUrl || process.env.META_DEFAULT_LINK_URL || process.env.FRONTEND_URL || 'https://repaircoin.ai';

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
        dailyBudgetCents,
        optimizationGoal: spec.optimizationGoal,
        billingEvent: spec.billingEvent,
        targeting: spec.targeting,
        promotedPageId: conn.pageId,
        // Pixel-Lead website-conversion optimization → promoted_object names the pixel + LEAD.
        conversionPixelId: spec.conversionOptimized ? spec.pixelId ?? undefined : undefined,
        customEventType: spec.conversionOptimized ? 'LEAD' : undefined,
      });
      // For native-lead-form objectives, attach a Meta instant form (best-effort → link
      // fallback). SKIP it for the pixel-conversion flavor (conversionOptimized) — that path
      // optimizes for the Lead pixel event on OUR landing page, with a normal link creative.
      let metaLeadFormId: string | undefined;
      if (spec.objective === 'OUTCOME_LEADS' && !spec.conversionOptimized && conn.pageTokenEnc) {
        try {
          const pageToken = decryptToken(conn.pageTokenEnc);
          metaLeadFormId = await metaService.ensureLeadForm(conn.pageId, pageToken, {
            name: `${campaign.name} — leads`, privacyPolicyUrl: linkUrl,
          });
        } catch (e: any) {
          logger.warn(`MetaPushService: lead form creation failed, using link creative — ${e?.message || e}`);
        }
      }
      metaCreativeId = await metaService.createAdCreative(conn.adAccountId, token, {
        pageId: conn.pageId,
        imageUrl: creative.imageUrl,
        headline: creative.headline ?? undefined,
        message: creative.body ?? undefined,
        linkUrl,
        leadFormId: metaLeadFormId,
        enhancements: campaign.allowMetaEnhancements,
      });
      metaAdId = await metaService.createAd(conn.adAccountId, token, {
        name: `${campaign.name} — ad`, adsetId: metaAdSetId, creativeId: metaCreativeId,
      });
      await this.campaigns.setMetaObjects(campaign.id, {
        metaCampaignId, metaAdSetId, metaCreativeId, metaAdId, metaStatus: 'PAUSED',
        metaLeadFormId: metaLeadFormId ?? null,
      });
      await this.creativeRepo.setMetaCreativeId(creative.id, metaCreativeId);
      logger.info(`MetaPushService: pushed PAUSED campaign ${metaCampaignId} (adset ${metaAdSetId}, ad ${metaAdId}) for shop ${shopId}`);
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
    // D5 — never act on a campaign whose Meta objects were archived/deleted in Ads Manager.
    if (campaign.status === 'archived') throw new Error('campaign_archived_on_meta: this campaign was archived or removed in Ads Manager; it cannot go live again');
    // Q8 review gate — the AI creative must be approved before it can spend.
    const creative = await this.creativeRepo.findAiByCampaign(campaignId);
    if (!creative || creative.reviewStatus !== 'approved') {
      throw new Error('creative_not_approved: approve the ad creative in the Creatives panel before going live');
    }
    const conn = await this.connections.getConnection(campaign.shopId);
    if (!conn?.userTokenEnc || !conn.adAccountId) throw new Error('meta_not_connected');
    const token = decryptToken(conn.userTokenEnc);
    const status = await metaService.getAccountStatus(conn.adAccountId, token);
    if (status.accountStatus !== 1) throw new Error('ad_account_not_active');
    if (!status.hasFunding) throw new Error('no_funding_source: add a payment method to the shop\'s Meta ad account before going live');
    const ids = [campaign.metaCampaignId, campaign.metaAdSetId, campaign.metaAdId].filter(Boolean) as string[];
    for (const id of ids) await metaService.setObjectStatus(id, 'ACTIVE', token);
    await this.campaigns.setMetaObjects(campaignId, { metaStatus: 'ACTIVE' });
    // Safeguard 4 — start the test-budget window at first go-live (the nightly check measures ROI
    // from here; once the window passes with ROI ≥ threshold it flags "ready to scale to full").
    if (campaign.isTestBudget && !campaign.testBudgetStartedAt) {
      await this.campaigns.update(campaignId, { testBudgetStartedAt: new Date() });
    }
  }

  /** Safeguard 4 — scale a test-budget campaign up to its full daily budget (admin confirms after
   *  the nightly check flags it ready). Pushes the new ad-set budget + exits test mode. */
  async scaleToFull(campaignId: string): Promise<void> {
    if (!this.enabled()) throw new Error('push_disabled');
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign) throw new Error('campaign_not_found');
    if (!campaign.isTestBudget || !campaign.fullDailyBudgetCents) throw new Error('not_a_test_budget_campaign');
    if (campaign.status === 'archived') throw new Error('campaign_archived_on_meta: this campaign was archived or removed in Ads Manager');
    // D6 clobber-guard: pull the latest config from Meta first (no-op unless ADS_META_CONFIG_SYNC),
    // so this scale-up acts on fresh state and stamps the sync rather than racing a manual edit.
    // D5 — if that reconcile finds the Meta objects gone/archived, halt instead of pushing to dead ids.
    const rc = await metaConfigSyncService.reconcile(campaignId);
    if (rc.status === 'diverged') throw new Error('campaign_archived_on_meta: this campaign was archived or removed in Ads Manager');
    const conn = await this.connections.getConnection(campaign.shopId);
    if (!conn?.userTokenEnc) throw new Error('meta_not_connected');
    const token = decryptToken(conn.userTokenEnc);
    if (campaign.metaAdSetId) {
      await metaService.updateAdSet(campaign.metaAdSetId, token, { dailyBudgetCents: campaign.fullDailyBudgetCents });
    }
    await this.campaigns.update(campaignId, {
      dailyBudgetCents: campaign.fullDailyBudgetCents,
      isTestBudget: false,
      testBudgetUpgradeReady: false,
    });
  }

  /** In-app draft edits: budget / radius and headline / primaryText / image. Works on BOTH a
   *  local 'draft' (pre-Meta — edits the stored config + AI creative only) and a PAUSED Meta
   *  draft (also pushes the change to Meta — a new creative, since Meta creatives are immutable).
   *  Any creative edit re-arms review (back to 'pending'). */
  async updateDraft(campaignId: string, edits: {
    dailyBudgetCents?: number; radiusMiles?: number; objective?: string;
    headline?: string; primaryText?: string; regenerateImage?: boolean; imagePrompt?: string;
    /** A manually-uploaded designer image (public URL) to use instead of AI generation. */
    manualImageUrl?: string;
    /** Opt into Meta Advantage+ creative enhancements (applies on the next creative push). */
    allowMetaEnhancements?: boolean;
    /** Safeguard 4 — start at a reduced test budget (only meaningful pre-push). */
    isTestBudget?: boolean;
    request?: AdCampaignRequest;
  }): Promise<void> {
    if (!this.enabled()) throw new Error('push_disabled');
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign) throw new Error('campaign_not_found');
    const onMeta = !!campaign.metaCampaignId; // pushed (PAUSED) vs local draft
    // D5 — never edit a campaign whose Meta objects were archived/deleted in Ads Manager.
    if (onMeta && campaign.status === 'archived') throw new Error('campaign_archived_on_meta: this campaign was archived or removed in Ads Manager');
    // D6 clobber-guard: for a pushed campaign, pull the latest config from Meta first (no-op
    // unless ADS_META_CONFIG_SYNC) so this in-app edit acts on current state, not a stale value.
    // D5 — if that reconcile finds the Meta objects gone/archived, halt instead of editing dead ids.
    if (onMeta) {
      const rc = await metaConfigSyncService.reconcile(campaignId);
      if (rc.status === 'diverged') throw new Error('campaign_archived_on_meta: this campaign was archived or removed in Ads Manager');
    }
    const conn = await this.connections.getConnection(campaign.shopId);
    if (onMeta && (!conn?.userTokenEnc || !conn.adAccountId || !conn.pageId)) throw new Error('meta_not_connected');
    const token = conn?.userTokenEnc ? decryptToken(conn.userTokenEnc) : '';

    // 1) Budget + radius — always persist locally; if on Meta, also push to the ad set.
    if (onMeta && conn) {
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
    }
    const dbUpdate: Record<string, any> = {};
    if (edits.dailyBudgetCents != null) dbUpdate.dailyBudgetCents = edits.dailyBudgetCents;
    if (edits.radiusMiles != null) dbUpdate.targetRadiusMiles = edits.radiusMiles;
    // Objective change is only meaningful before the push (it's baked into the Meta campaign).
    if (edits.objective && !onMeta) dbUpdate.objective = asMetaObjective(edits.objective) ?? undefined;
    if (edits.allowMetaEnhancements !== undefined) dbUpdate.allowMetaEnhancements = edits.allowMetaEnhancements;
    // Test-budget toggle is only meaningful before the push (it sets the launch budget).
    if (edits.isTestBudget !== undefined && !onMeta) dbUpdate.isTestBudget = edits.isTestBudget;
    if (Object.keys(dbUpdate).length) await this.campaigns.update(campaignId, dbUpdate);

    // 2) Creative — manual image upload, AI regenerate, or text-only edit. Always re-arms review.
    const manualImageUrl = edits.manualImageUrl?.trim();
    const regenerateImage = !!(edits.regenerateImage || edits.imagePrompt?.trim());
    const wantsCreativeEdit = !!(edits.headline || edits.primaryText || regenerateImage || manualImageUrl);
    if (!wantsCreativeEdit) return;

    const current = await this.creativeRepo.findAiByCampaign(campaignId);
    let imageUrl: string;
    let headline: string | null;
    let primaryText: string | null;
    let linkUrl: string;
    let generationPrompt: string | null;
    if (manualImageUrl) {
      // Designer-uploaded image — use it directly, no AI. Must be a valid public URL (Meta needs it).
      const valid = publicUrl(manualImageUrl);
      if (!valid) throw new Error('invalid_image_url: the uploaded image must be a public URL');
      imageUrl = valid;
      headline = edits.headline || current?.headline || null;
      primaryText = edits.primaryText || current?.body || null;
      linkUrl = current?.landingUrl || landingUrlFor(campaignId) || process.env.META_DEFAULT_LINK_URL || process.env.FRONTEND_URL || 'https://repaircoin.ai';
      generationPrompt = null; // not AI-generated
    } else if (regenerateImage) {
      if (!edits.request) throw new Error('cannot_regenerate_without_request');
      const fresh = await this.creatives.build(campaign.shopId, edits.request, campaign.name, { imagePrompt: edits.imagePrompt, landingUrl: landingUrlFor(campaignId), campaignId });
      imageUrl = fresh.imageUrl;
      headline = edits.headline || fresh.headline;
      primaryText = edits.primaryText || fresh.primaryText;
      linkUrl = fresh.linkUrl;
      generationPrompt = fresh.imagePrompt;
    } else {
      // Text-only edit — keep the current stored image.
      if (!current?.imageUrl) throw new Error('creative_unavailable_for_text_edit');
      imageUrl = current.imageUrl;
      headline = edits.headline || current.headline;
      primaryText = edits.primaryText || current.body;
      linkUrl = current.landingUrl || process.env.META_DEFAULT_LINK_URL || process.env.FRONTEND_URL || 'https://repaircoin.ai';
      generationPrompt = current.generationPrompt;
    }

    // Persist the edited creative locally (→ pending). meta_creative_id is cleared by upsertAi.
    const saved = await this.creativeRepo.upsertAi({
      campaignId, imageUrl, headline, body: primaryText, landingUrl: linkUrl, generationPrompt,
    });
    // Safeguard 5 — the creative was just swapped, so clear the "needs refresh" nudge.
    await this.campaigns.setCreativeRefresh(campaignId, false).catch(() => undefined);

    // If the campaign is already on Meta, push the new creative and re-point the ad at it.
    if (onMeta && conn && campaign.metaAdId) {
      const oldCreativeId = campaign.metaCreativeId;
      const newCreativeId = await metaService.createAdCreative(conn.adAccountId, token, {
        pageId: conn.pageId!, imageUrl, headline: headline ?? undefined, message: primaryText ?? undefined, linkUrl,
        leadFormId: campaign.metaLeadFormId ?? undefined,
        enhancements: campaign.allowMetaEnhancements,
      });
      await metaService.updateAdCreative(campaign.metaAdId, token, newCreativeId);
      await this.campaigns.setMetaObjects(campaignId, { metaCreativeId: newCreativeId });
      await this.creativeRepo.setMetaCreativeId(saved.id, newCreativeId);
      if (oldCreativeId) await metaService.deleteObject(oldCreativeId, token); // best-effort cleanup
    }
  }
}

export const metaPushService = new MetaPushService();
