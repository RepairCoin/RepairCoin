// backend/src/domains/AdsDomain/controllers/CampaignRequestController.ts
//
// Recurring campaign requests (lifecycle Phase 3). Shop submits (capacity-checked,
// §9.5 + decision #2 soft-block + upsell); admin builds it into a live campaign or
// declines. Concierge: campaign creation stays admin-only (Q8). Posts to the durable
// thread on each transition.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { AdsEvents } from '../events';
import { CampaignRequestRepository } from '../repositories/CampaignRequestRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { BillingPlanRepository, limitsForTier } from '../repositories/BillingPlanRepository';
import { GoogleConnectionRepository } from '../repositories/GoogleConnectionRepository';
import { googleAdsService } from '../services/GoogleAdsService';
import { googleAdsCreativeService } from '../services/GoogleAdsCreativeService';
import { decryptToken } from '../../../utils/tokenCrypto';
import { SafeguardRepository } from '../repositories/SafeguardRepository';
import { AdMessageRepository } from '../repositories/AdMessageRepository';
import { NotificationRepository } from '../../../repositories/NotificationRepository';
import { AdBillingService } from '../services/AdBillingService';
import { parseBrief } from '../services/briefValidation';
import { metaPushService } from '../services/MetaPushService';
import { metaConfigSyncService } from '../services/MetaConfigSyncService';
import { googlePushService } from '../services/GooglePushService';
import { googleConfigSyncService } from '../services/GoogleConfigSyncService';
import { shopRepository } from '../../../repositories';
import { imageStorageService } from '../../../services/ImageStorageService';

const requests = new CampaignRequestRepository();
const googleConnections = new GoogleConnectionRepository();
const campaigns = new CampaignRepository();
const plans = new BillingPlanRepository();
const safeguards = new SafeguardRepository();
const messages = new AdMessageRepository();
const notifications = new NotificationRepository();
const billing = new AdBillingService();

const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;
const adminId = (req: Request): string => (req as any).user?.address ?? 'admin';

async function notifyShop(shopId: string, message: string): Promise<void> {
  try {
    const shop = await shopRepository.getShop(shopId);
    const receiver = (shop as any)?.walletAddress || (shop as any)?.wallet_address;
    if (receiver) await notifications.create({ senderAddress: 'system', receiverAddress: receiver, notificationType: 'ad_campaign_request', message, metadata: { shopId } });
  } catch (err) { logger.error('CampaignRequestController.notifyShop failed', err); }
}
async function notifyAdmins(message: string, metadata: any): Promise<void> {
  try {
    const addrs = (process.env.ADMIN_ADDRESSES || '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
    for (const receiver of addrs) await notifications.create({ senderAddress: 'system', receiverAddress: receiver, notificationType: 'ad_campaign_request', message, metadata });
  } catch (err) { logger.error('CampaignRequestController.notifyAdmins failed', err); }
}
const postEvent = (shopId: string, body: string) => messages.postEvent(shopId, body).catch((e) => logger.error('postEvent failed', e));

// ---- Shop ----
// POST /shop/campaign-requests
export async function submitCampaignRequest(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }

  // §9.5 / decision #2 — soft-block + upsell at the tier's campaign cap.
  const cap = await billing.getShopCapacity(shopId);
  if (cap.remaining <= 0) {
    res.status(409).json({
      success: false, error: 'tier_capacity_reached',
      message: `You're using ${cap.usedCampaigns} of ${cap.maxCampaigns} campaigns on the ${cap.tier} plan. Upgrade for more.`,
      data: cap,
    });
    return;
  }

  const parsed = parseBrief(req.body?.brief);
  if ('error' in parsed) { res.status(400).json({ success: false, error: parsed.error }); return; }

  // Server-side tier gate (defense-in-depth behind the FE channel picker): reject a Google-channel
  // request at submission for a non-Business shop, so it fails immediately with a clear message
  // instead of later at build. Mirrors the build-time check in buildCampaignFromRequest.
  if (parsed.brief.channel === 'google') {
    const plan = await plans.getOrDefault(shopId);
    if (!limitsForTier(plan.flatTierName).channels.includes('google')) {
      res.status(403).json({ success: false, error: 'google_requires_business_tier', message: 'Google Ads campaigns require the Business plan.' });
      return;
    }
  }

  const message = (req.body?.message || '').toString().slice(0, 1000) || null;
  try {
    const r = await requests.create(shopId, parsed.brief, message);
    void postEvent(shopId, 'Shop requested a new campaign.');
    await notifyAdmins(`Shop ${shopId} requested a new campaign.`, { shopId, requestId: r.id });
    res.status(201).json({ success: true, data: r });
  } catch (err) {
    logger.error('CampaignRequestController.submitCampaignRequest failed', err);
    res.status(500).json({ success: false, error: 'Failed to submit request' });
  }
}

// GET /shop/campaign-requests
export async function listMyCampaignRequests(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    res.json({ success: true, data: await requests.listByShop(shopId) });
  } catch (err) {
    logger.error('CampaignRequestController.listMyCampaignRequests failed', err);
    res.status(500).json({ success: false, error: 'Failed to load requests' });
  }
}

// ---- Admin ----
// GET /campaign-requests
export async function listCampaignRequests(req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await requests.list(req.query.status as any) });
  } catch (err) {
    logger.error('CampaignRequestController.listCampaignRequests failed', err);
    res.status(500).json({ success: false, error: 'Failed to list requests' });
  }
}

// POST /campaign-requests/:id/build — create a live campaign from the request (concierge).
export async function buildCampaignFromRequest(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  try {
    const r = await requests.findById(id);
    if (!r) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
    if (r.status === 'live' || r.status === 'building' || r.status === 'declined' || r.status === 'cancelled') {
      // 'building' = already built (or a prior build that completed server-side after a client
      // timeout) — block a duplicate. Failed builds roll back and stay pending/approved.
      res.status(400).json({ success: false, error: `Request already ${r.status}` }); return;
    }
    // Multi-channel (Google plan, Slice 3): build the campaign on the shop's connected Google Ads
    // account. Business-tier gated (defense-in-depth behind the FE picker). Objects are created PAUSED
    // (never serve/spend until go-live). Gated by ADS_GOOGLE_PUSH_ENABLED.
    if (r.channel === 'google') {
      const plan = await plans.getOrDefault(r.shopId);
      if (!limitsForTier(plan.flatTierName).channels.includes('google')) {
        res.status(403).json({ success: false, error: 'google_requires_business_tier', message: 'Google Ads campaigns require the Business plan.' });
        return;
      }
      if (!(process.env.ADS_GOOGLE_PUSH_ENABLED === 'true' && googleAdsService.isConfigured())) {
        res.status(409).json({ success: false, error: 'google_push_disabled', message: "Google campaigns aren't enabled yet." });
        return;
      }
      const gconn = await googleConnections.getConnection(r.shopId);
      if (!gconn?.connected || !gconn.refreshTokenEnc || !gconn.customerId) {
        res.status(409).json({ success: false, error: 'google_not_connected', message: "Connect this shop's Google Ads account first." });
        return;
      }
      const gName = (req.body?.name || '').toString().trim() || `Campaign — ${r.goal ?? 'ads'}`;
      const gDailyCents = req.body?.dailyBudgetCents ?? (r.monthlyBudgetCents ? Math.round(r.monthlyBudgetCents / 30) : 0);
      const gRefreshEnc = gconn.refreshTokenEnc; // non-null (guarded above)
      const gCustomerId = gconn.customerId;
      const gManagerId = gconn.managerId ?? undefined; // login-customer-id (per-shop, not global env)
      const gAdmin = adminId(req);
      const campaign = await campaigns.create({
        shopId: r.shopId, name: gName, platform: 'google',
        targetRadiusMiles: r.targetRadiusMiles ?? null, dailyBudgetCents: gDailyCents,
        notes: r.offer ? `Offer: ${r.offer}` : null, createdBy: gAdmin,
      } as any);
      await safeguards.ensureDefault(campaign.id);
      // Respond FAST, then create the Google objects in the BACKGROUND. The full push (budget →
      // campaign → ad group → RSA → keywords, plus an AI copy call) exceeds the gateway timeout if
      // done synchronously (→ 504). Mirrors the Meta async push; the campaign appears as a building
      // draft immediately and flips to 'draft' when the objects land (or is removed on failure).
      const updated = await requests.setStatus(id, 'building', { campaignId: campaign.id, decidedBy: gAdmin });
      res.status(201).json({ success: true, data: { request: updated, campaign, platform: 'google', pushing: true } });
      void (async () => {
        try {
          const token = decryptToken(gRefreshEnc);
          const g = await googleAdsService.createSearchCampaign(gCustomerId, token, { name: gName, dailyBudgetMicros: gDailyCents * 10000 }, gManagerId);
          await campaigns.setGoogleObjects(campaign.id, {
            googleCampaignId: g.campaignId, googleAdGroupId: g.adGroupId,
            googleBudgetId: g.budgetResourceName.split('/').pop(), googleStatus: 'PAUSED',
          });
          const copy = await googleAdsCreativeService.generateRsaCopy(r.shopId, { offer: r.offer, campaignId: campaign.id });
          const landingBase = (process.env.ADS_LANDING_BASE_URL || process.env.FRONTEND_URL || 'https://staging.repaircoin.ai').replace(/\/$/, '');
          await googleAdsService.addResponsiveSearchAdAndKeywords(gCustomerId, token, g.adGroupResourceName, {
            headlines: copy.headlines, descriptions: copy.descriptions, keywords: copy.keywords,
            finalUrl: `${landingBase}/l/${campaign.id}`,
          }, gManagerId);
          await campaigns.update(campaign.id, { status: 'draft' }); // local draft; PAUSED on Google
          void postEvent(r.shopId, `Google campaign "${gName}" created (paused) — review, then take it live.`);
        } catch (err: any) {
          logger.error('buildCampaignFromRequest: google push (background) failed', err?.message || err);
          await campaigns.softDelete(campaign.id).catch(() => undefined); // orphaned Google objects are PAUSED → no spend
          await requests.setStatus(id, 'approved', { decidedBy: gAdmin }).catch(() => undefined); // revert so it can be rebuilt
          void postEvent(r.shopId, `Google campaign build failed — please retry. (${err?.message || 'error'})`);
        }
      })();
      return;
    }
    // §9.6 — can't go live until the shop's ad account is connected.
    if (!(await plans.isAdsAccountConnected(r.shopId))) {
      res.status(409).json({ success: false, error: 'ad_account_not_connected', message: `Connect ${r.shopId}'s ad account before building a live campaign.` });
      return;
    }
    // Re-check capacity at build time (§9.5).
    const cap = await billing.getShopCapacity(r.shopId);
    if (cap.remaining <= 0) {
      res.status(409).json({ success: false, error: 'tier_capacity_reached', message: `Shop is at ${cap.usedCampaigns}/${cap.maxCampaigns} campaigns (${cap.tier}).`, data: cap });
      return;
    }

    const name = (req.body?.name || '').toString().trim() || `Campaign — ${r.goal ?? 'ads'}`;
    const dailyBudgetCents = req.body?.dailyBudgetCents
      ?? (r.monthlyBudgetCents ? Math.round(r.monthlyBudgetCents / 30) : 0);

    const campaign = await campaigns.create({
      shopId: r.shopId,
      name,
      platform: r.channel ?? 'meta', // forward-compat; google builds are blocked above
      targetRadiusMiles: r.targetRadiusMiles ?? null,
      dailyBudgetCents,
      notes: r.offer ? `Offer: ${r.offer}` : null,
      createdBy: adminId(req),
    } as any);
    await safeguards.ensureDefault(campaign.id);

    // Stage-4 PREPARE (Option B): build a LOCAL draft + generate the AI creative — nothing is
    // pushed to Meta yet. The admin reviews/edits/approves the creative + budget, then hits
    // "Push to Meta" (PAUSED) → "Go live". Until ADS_META_PUSH_ENABLED, stays record-only.
    if (metaPushService.enabled()) {
      try {
        await metaPushService.prepareCreative(r.shopId, r, campaign.id, name);
      } catch (err: any) {
        await campaigns.softDelete(campaign.id); // roll back our record (no Meta objects created)
        logger.error('buildCampaignFromRequest: prepare creative failed', err?.message || err);
        res.status(502).json({ success: false, error: 'prepare_failed', message: err?.message || 'Failed to generate the ad creative.' });
        return;
      }
      await campaigns.update(campaign.id, { status: 'draft' }); // local draft, not on Meta yet
      const updated = await requests.setStatus(id, 'building', { campaignId: campaign.id, decidedBy: adminId(req) });
      void postEvent(r.shopId, `Campaign "${name}" drafted — review the creative & details, then push it live.`);
      await notifyShop(r.shopId, `Your campaign "${name}" is being prepared — we'll take it live shortly.`);
      res.status(201).json({ success: true, data: { request: updated, campaign, prepared: true } });
      return;
    }

    // Concierge / record-only path (push disabled) — unchanged: go live immediately as a record.
    await campaigns.update(campaign.id, { status: 'active' }); // go live → billing starts (§9.2, nightly)
    const updated = await requests.setStatus(id, 'live', { campaignId: campaign.id, decidedBy: adminId(req) });
    void postEvent(r.shopId, `Campaign "${name}" is live.`);
    await notifyShop(r.shopId, `Your campaign "${name}" is now live.`);
    await eventBus.publish(createDomainEvent(AdsEvents.CAMPAIGN_CREATED, campaign.id, { shopId: r.shopId, name }, 'AdsDomain'));
    res.status(201).json({ success: true, data: { request: updated, campaign } });
  } catch (err) {
    logger.error('CampaignRequestController.buildCampaignFromRequest failed', err);
    res.status(500).json({ success: false, error: 'Failed to build campaign' });
  }
}

// POST /campaign-requests/:id/decline
export async function declineCampaignRequest(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  try {
    const r = await requests.findById(id);
    if (!r) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
    const reason = (req.body?.declineReason || '').toString().slice(0, 500) || null;
    const updated = await requests.setStatus(id, 'declined', { declineReason: reason ?? undefined, decidedBy: adminId(req) });
    void postEvent(r.shopId, `Campaign request declined${reason ? `: ${reason}` : '.'}`);
    await notifyShop(r.shopId, `A campaign request was declined${reason ? `: ${reason}` : '.'} You're not billed for it — feel free to revise and resubmit.`);
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('CampaignRequestController.declineCampaignRequest failed', err);
    res.status(500).json({ success: false, error: 'Failed to decline request' });
  }
}

// POST /campaigns/:id/creative-image (admin, multipart 'image') — upload a designer-made image
// for the campaign's creative. Stores it under the campaign's shop folder (public URL) and
// returns the URL; the caller then PATCHes the draft with manualImageUrl to use it.
export async function uploadCreativeImage(req: Request, res: Response): Promise<void> {
  try {
    const file = (req as any).file;
    if (!file) { res.status(400).json({ success: false, error: 'No image file provided' }); return; }
    const campaign = await campaigns.findById(req.params.id);
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    // Reuse the AI-source bucket path so the URL is recognized as shop-owned + public.
    const result = await imageStorageService.uploadAiSource(file, campaign.shopId);
    if (!result.success || !result.url) { res.status(400).json({ success: false, error: result.error || 'upload_failed' }); return; }
    res.json({ success: true, data: { url: result.url } });
  } catch (err) {
    logger.error('CampaignRequestController.uploadCreativeImage failed', err);
    res.status(500).json({ success: false, error: 'Failed to upload image' });
  }
}

// POST /campaigns/:id/push (admin) — create the PAUSED Meta objects from a reviewed local draft.
// ASYNC: the push runs ~6 sequential Meta Graph calls (incl. the slow creative/image upload),
// which exceeded the upstream gateway timeout → the caller got a 504. So validate fast, return
// 202 immediately, and create the Meta objects in the BACKGROUND. On success the campaign flips
// draft → paused (the client polls for that); on failure we post an event the admin can see and
// the campaign stays a draft (clean to retry). See MetaPushService.pushPreparedCampaign.
export async function pushCampaignToMeta(req: Request, res: Response): Promise<void> {
  const campaignId = req.params.id;
  let campaign;
  try {
    campaign = await campaigns.findById(campaignId);
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    if (campaign.metaCampaignId) { res.status(400).json({ success: false, error: 'already_pushed', message: 'This campaign is already on Meta.' }); return; }
  } catch (err: any) {
    logger.error('CampaignRequestController.pushCampaignToMeta lookup failed', err?.message || err);
    res.status(500).json({ success: false, error: 'Failed to start the push.' });
    return;
  }

  // Fast validation BEFORE responding (one Graph call, no object creation) so the common failures
  // — not connected, no/unapproved creative, inactive account, budget below the currency minimum —
  // come back INLINE to the admin immediately, instead of as a delayed message-feed event.
  try {
    await metaPushService.precheckPush(campaign.shopId, campaign);
  } catch (err: any) {
    logger.warn('CampaignRequestController.pushCampaignToMeta precheck rejected', { campaignId, message: err?.message });
    res.status(422).json({ success: false, error: 'precheck_failed', message: err?.message || 'Validation failed.' });
    return;
  }

  // Respond now; the heavy Meta object creation continues in the background (avoids the 504).
  res.status(202).json({ success: true, data: { campaignId, status: 'pushing' } });

  void (async () => {
    try {
      const request = await requests.findByCampaignId(campaignId);
      await metaPushService.pushPreparedCampaign(campaign.shopId, request, campaign);
      await campaigns.update(campaignId, { status: 'paused' }); // drafted on Meta, not yet live
      void postEvent(campaign.shopId, `Campaign "${campaign.name}" pushed to Meta (paused) — review & go live.`);
    } catch (err: any) {
      logger.error('CampaignRequestController.pushCampaignToMeta (background) failed', err?.message || err);
      void postEvent(campaign.shopId, `⚠️ Couldn't push "${campaign.name}" to Meta: ${err?.message || 'unknown error'}. It's still a draft — please try again.`);
    }
  })();
}

// POST /campaigns/:id/scale-to-full (admin) — Safeguard 4: scale a test-budget campaign up to
// its full daily budget after the nightly check flagged it ready.
export async function scaleCampaignBudget(req: Request, res: Response): Promise<void> {
  const campaignId = req.params.id;
  try {
    const campaign = await campaigns.findById(campaignId);
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    await metaPushService.scaleToFull(campaignId); // throws → 502
    void postEvent(campaign.shopId, `Campaign "${campaign.name}" scaled to full budget.`);
    res.json({ success: true, data: await campaigns.findById(campaignId) });
  } catch (err: any) {
    logger.error('CampaignRequestController.scaleCampaignBudget failed', err?.message || err);
    res.status(502).json({ success: false, error: 'scale_failed', message: err?.message || 'Failed to scale the budget.' });
  }
}

// POST /campaigns/:id/sync-from-meta (admin) — two-way config sync: pull the campaign's current
// budget/status back FROM Meta into our DB (Meta is source-of-truth for live). Returns the fresh
// campaign + the applied changes. No-op (changes {}) when ADS_META_CONFIG_SYNC is off.
export async function syncCampaignFromMeta(req: Request, res: Response): Promise<void> {
  const campaignId = req.params.id;
  try {
    const campaign = await campaigns.findById(campaignId);
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    const result = await metaConfigSyncService.reconcile(campaignId);
    res.json({ success: true, data: { campaign: await campaigns.findById(campaignId), ...result } });
  } catch (err: any) {
    logger.error('CampaignRequestController.syncCampaignFromMeta failed', err?.message || err);
    res.status(502).json({ success: false, error: 'sync_failed', message: err?.message || 'Failed to sync from Meta.' });
  }
}

// POST /campaigns/:id/sync-from-google (admin) — two-way config sync: pull the campaign's current
// budget/status back FROM Google into our DB (Google is source-of-truth for live). Returns the fresh
// campaign + the applied changes. No-op (changes {}) when ADS_GOOGLE_CONFIG_SYNC is off.
export async function syncCampaignFromGoogle(req: Request, res: Response): Promise<void> {
  const campaignId = req.params.id;
  try {
    const campaign = await campaigns.findById(campaignId);
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    const result = await googleConfigSyncService.reconcile(campaignId);
    res.json({ success: true, data: { campaign: await campaigns.findById(campaignId), ...result } });
  } catch (err: any) {
    logger.error('CampaignRequestController.syncCampaignFromGoogle failed', err?.message || err);
    res.status(502).json({ success: false, error: 'sync_failed', message: err?.message || 'Failed to sync from Google.' });
  }
}

// POST /campaigns/:id/go-live (admin) — Option B: activate a PAUSED Meta draft after review.
// Verifies a funding source, activates campaign/adset/ad on Meta, flips our campaign → active
// + the request → live (billing starts §9.2).
export async function goLiveCampaign(req: Request, res: Response): Promise<void> {
  const campaignId = req.params.id;
  try {
    const campaign = await campaigns.findById(campaignId);
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    // Google draft → enable on Google (conversion-action + funding checks); else Meta go-live.
    if (campaign.googleCampaignId) {
      await googlePushService.goLive(campaignId); // throws on conversion/funding/connect/Google error
    } else {
      await metaPushService.goLive(campaignId); // throws on funding / connect / Graph error
    }
    await campaigns.update(campaignId, { status: 'active' });
    await requests.setLiveByCampaign(campaignId);
    void postEvent(campaign.shopId, `Campaign "${campaign.name}" is now live.`);
    await notifyShop(campaign.shopId, `Your campaign "${campaign.name}" is now live.`);
    await eventBus.publish(createDomainEvent(AdsEvents.CAMPAIGN_CREATED, campaignId, { shopId: campaign.shopId, name: campaign.name }, 'AdsDomain'));
    res.json({ success: true, data: { campaignId, status: 'active' } });
  } catch (err: any) {
    logger.error('CampaignRequestController.goLiveCampaign failed', err?.message || err);
    res.status(502).json({ success: false, error: 'go_live_failed', message: err?.message || 'Failed to go live.' });
  }
}

// PATCH /campaigns/:id/draft (admin) — Phase-5 Level-2 in-app edits before go-live.
export async function updateCampaignDraft(req: Request, res: Response): Promise<void> {
  const campaignId = req.params.id;
  try {
    const campaign = await campaigns.findById(campaignId);
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    const request = await requests.findByCampaignId(campaignId);
    await metaPushService.updateDraft(campaignId, {
      dailyBudgetCents: req.body?.dailyBudgetCents,
      radiusMiles: req.body?.radiusMiles,
      objective: typeof req.body?.objective === 'string' ? req.body.objective : undefined,
      manualImageUrl: typeof req.body?.manualImageUrl === 'string' ? req.body.manualImageUrl : undefined,
      allowMetaEnhancements: typeof req.body?.allowMetaEnhancements === 'boolean' ? req.body.allowMetaEnhancements : undefined,
      isTestBudget: typeof req.body?.isTestBudget === 'boolean' ? req.body.isTestBudget : undefined,
      headline: req.body?.headline,
      primaryText: req.body?.primaryText,
      regenerateImage: req.body?.regenerateImage === true,
      imagePrompt: typeof req.body?.imagePrompt === 'string' ? req.body.imagePrompt : undefined,
      request: request ?? undefined,
    });
    res.json({ success: true, data: await campaigns.findById(campaignId) });
  } catch (err: any) {
    logger.error('CampaignRequestController.updateCampaignDraft failed', err?.message || err);
    res.status(502).json({ success: false, error: 'draft_update_failed', message: err?.message || 'Failed to update the draft.' });
  }
}

// POST /shops/:shopId/ads-account (admin) — mark the shop's ad account connected/disconnected (§9.6).
export async function setAdsAccountConnected(req: Request, res: Response): Promise<void> {
  const shopId = req.params.shopId;
  const connected = req.body?.connected === true;
  try {
    await plans.setAdsAccountConnected(shopId, connected);
    void postEvent(shopId, connected ? 'Ad account connected — campaigns can now go live.' : 'Ad account disconnected.');
    res.json({ success: true, data: { shopId, connected } });
  } catch (err) {
    logger.error('CampaignRequestController.setAdsAccountConnected failed', err);
    res.status(500).json({ success: false, error: 'Failed to update ad account' });
  }
}
