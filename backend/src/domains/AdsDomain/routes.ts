// backend/src/domains/AdsDomain/routes.ts
//
// Ads routes, mounted at /api/ads by DomainRegistry. Admin = requireRole(['admin']);
// shop = requireRole(['shop']) with shopId sourced from the JWT (never a path param).
// Per Stage-0 scope: super_admin/ads_manager collapse to 'admin'; no 'employee' in v1.

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { requireShopPermission } from '../../middleware/permissions';
import {
  createCampaign, listCampaigns, getCampaign, updateCampaign, deleteCampaign,
  listShopCampaigns, getShopCapacity,
} from './controllers/CampaignController';
import {
  createCreative, listCreatives, updateCreative, reviewCreative, deleteCreative,
} from './controllers/CreativeController';
import {
  listLeads, createManualLead, updateLeadStatus, updateShopLeadStatus, listShopLeads, webformLead, draftLeadReply,
  listAwaitingLeads, listShopAwaitingLeads,
  getLeadThread, postLeadMessage, autoAnswerLead, inboundLeadMessage,
  getLeadActivities, logLeadActivity, emailLead,
  getShopLeadActivities, logShopLeadActivity, emailShopLead,
} from './controllers/LeadController';
import {
  getCampaignPerformance, getShopCampaignPerformance, enterDailyMetrics, getAllShopsSummary,
  getIndustryAnalytics, getCampaignMargin, getMarginSummary,
} from './controllers/PerformanceController';
import { verifyMetaWebhook, receiveMetaWebhook } from './controllers/MetaWebhookController';
import { receiveResendWebhook } from './controllers/ResendWebhookController';
import {
  createExperiment, listExperiments, getExperimentReport, setExperimentWinner,
} from './controllers/ExperimentController';
import {
  getBillingPlan, setBillingPlan, getShopBilling, getBillingSummary, triggerAccrual, invoiceShop,
} from './controllers/BillingController';
import {
  requestAds, getMyEnrollment, listEnrollments, decideEnrollment,
} from './controllers/EnrollmentController';
import { getAdChannels } from './controllers/AdChannelController';
import {
  getMyMessages, postMyMessage, listShopMessages, postAdminMessage, getMessageInbox,
} from './controllers/MessageController';
import {
  submitCampaignRequest, listMyCampaignRequests, listCampaignRequests,
  buildCampaignFromRequest, declineCampaignRequest, setAdsAccountConnected,
  pushCampaignToMeta, goLiveCampaign, updateCampaignDraft, uploadCreativeImage, scaleCampaignBudget,
  syncCampaignFromMeta,
} from './controllers/CampaignRequestController';
import {
  getMySubscription, changeMyTier, cancelMySubscription,
} from './controllers/SubscriptionController';
import {
  getMetaConnectUrl, handleMetaOauthCallback, listMyMetaAccounts, selectMyMetaAccount,
  getMyMetaConnection, disconnectMyMeta, handleMetaDeauthorize, handleMetaDataDeletion,
  triggerMetaInsightsSync, getShopMetaAccount,
} from './controllers/MetaConnectController';
import { getCampaignLanding, getLandingConfig, updateLandingConfig } from './controllers/LandingController';
import { taxonomyFor } from './services/industryTaxonomies';

export function initializeRoutes(): Router {
  const router = Router();
  const admin = [authMiddleware, requireRole(['admin'])];
  const shop = [authMiddleware, requireRole(['shop']), requireShopPermission('marketing:manage')];
  // Multipart for the designer-image upload on a campaign creative (memory → DO Spaces).
  const creativeUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
    fileFilter: (_req, file, cb) =>
      cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
  });

  // Health — confirms the domain is registered.
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ domain: 'ads', status: 'live', stage: '2' });
  });

  // PUBLIC — ad landing-page data (shop + offer + promoted services) for /l/:campaignId.
  router.get('/landing/:campaignId', getCampaignLanding);

  // PUBLIC — landing-page lead webform (UTM-attributed). No auth: attribution is
  // by campaign id / utm params in the body. (Stage 2.)
  router.post('/leads/webform', webformLead);

  // PUBLIC — inbound lead reply from a channel webhook (Stage 3.5). Auto-answers when
  // the campaign has ai_agent_enabled. Guarded by ADS_INBOUND_WEBHOOK_TOKEN when set.
  router.post('/leads/inbound', inboundLeadMessage);

  // PUBLIC — Meta Lead Ads webhook (Stage 4). GET = verification handshake;
  // POST = signed lead delivery (raw body parsed in app.ts for signature check).
  router.get('/webhooks/meta/leads', verifyMetaWebhook);
  router.post('/webhooks/meta/leads', receiveMetaWebhook);

  // PUBLIC — Resend email webhook (lead follow-up Phase 4). Svix-signed delivery/open/click/bounce
  // events; raw body parsed in app.ts for the signature check.
  router.post('/webhooks/resend', receiveResendWebhook);

  // PUBLIC — Meta OAuth callback (browser redirect from Facebook). shopId is read from the
  // signed `state`, never a param; on success stores the token and bounces to the picker.
  router.get('/meta/oauth/callback', handleMetaOauthCallback);

  // PUBLIC — Meta signed_request callbacks (app removed / data-deletion request). The service
  // verifies the signature; both map the Meta user id → shop and clear the connection.
  router.post('/meta/deauthorize', handleMetaDeauthorize);
  router.post('/meta/data-deletion', handleMetaDataDeletion);

  // ---- Admin: campaigns ----
  router.post('/campaigns', ...admin, createCampaign);
  router.get('/campaigns', ...admin, listCampaigns);
  router.get('/campaigns/:id', ...admin, getCampaign);
  router.patch('/campaigns/:id', ...admin, updateCampaign);
  router.delete('/campaigns/:id', ...admin, deleteCampaign);
  router.get('/campaigns/:id/performance', ...admin, getCampaignPerformance);
  router.post('/campaigns/:id/metrics', ...admin, enterDailyMetrics);   // Stage 1: daily entry
  router.get('/analytics/summary', ...admin, getAllShopsSummary);        // Stage 1: all-shops rollup
  router.get('/analytics/by-industry', ...admin, getIndustryAnalytics);  // Stage 5: per-industry
  router.get('/analytics/margin', ...admin, getMarginSummary);           // Q6: all-shops true margin
  router.get('/campaigns/:id/margin', ...admin, getCampaignMargin);      // Q6: per-campaign true margin

  // ---- Admin: ad-management billing (Q4/Q7 — Plan A/B/C) ----
  router.get('/analytics/billing', ...admin, getBillingSummary);         // platform-wide accrued revenue
  router.post('/billing/accrue', ...admin, triggerAccrual);              // run accrual now (also nightly)
  router.get('/shops/:shopId/billing-plan', ...admin, getBillingPlan);
  router.put('/shops/:shopId/billing-plan', ...admin, setBillingPlan);
  router.get('/shops/:shopId/billing', ...admin, getShopBilling);
  router.post('/shops/:shopId/billing/invoice', ...admin, invoiceShop); // gated Stripe push
  router.get('/messages/inbox', ...admin, getMessageInbox);             // all-shop comms inbox (#2)
  router.get('/shops/:shopId/messages', ...admin, listShopMessages);    // durable thread (Phase 2)
  router.post('/shops/:shopId/messages', ...admin, postAdminMessage);
  router.get('/campaign-requests', ...admin, listCampaignRequests);     // build queue (Phase 3)
  router.post('/campaign-requests/:id/build', ...admin, buildCampaignFromRequest);
  router.post('/campaign-requests/:id/decline', ...admin, declineCampaignRequest);
  router.post('/campaigns/:id/creative-image', ...admin, creativeUpload.single('image'), uploadCreativeImage); // manual designer image → public URL
  router.post('/campaigns/:id/push', ...admin, pushCampaignToMeta);             // prepare→push: create PAUSED Meta objects from a reviewed draft
  router.post('/campaigns/:id/go-live', ...admin, goLiveCampaign);              // push P5: activate a PAUSED draft
  router.post('/campaigns/:id/scale-to-full', ...admin, scaleCampaignBudget);   // Safeguard 4: test budget → full
  router.post('/campaigns/:id/sync-from-meta', ...admin, syncCampaignFromMeta); // two-way config sync: pull budget/status from Meta
  router.patch('/campaigns/:id/draft', ...admin, updateCampaignDraft);          // push P5: edit budget/radius/creative (draft or paused)
  router.get('/campaigns/:id/landing-config', ...admin, getLandingConfig);       // landing magnet overrides (editor)
  router.put('/campaigns/:id/landing-config', ...admin, updateLandingConfig);    // save landing magnet overrides
  router.post('/shops/:shopId/ads-account', ...admin, setAdsAccountConnected);  // §9.6 connect gate
  router.get('/shops/:shopId/meta-account', ...admin, getShopMetaAccount);       // account currency + min daily budget
  router.post('/meta/sync-insights', ...admin, triggerMetaInsightsSync);        // push P3: import Meta spend/impr/clicks now

  // ---- Admin: A/B experiments (Stage 5) ----
  router.post('/campaigns/:id/experiments', ...admin, createExperiment);
  router.get('/campaigns/:id/experiments', ...admin, listExperiments);
  router.get('/experiments/:id/report', ...admin, getExperimentReport);
  router.patch('/experiments/:id/winner', ...admin, setExperimentWinner);

  // ---- Industry default service taxonomy (Stage 5) ----
  router.get('/industries/:slug/services', ...admin, (req, res) => {
    res.json({ success: true, data: taxonomyFor(req.params.slug) });
  });

  // ---- Admin: creatives ----
  router.post('/campaigns/:id/creatives', ...admin, createCreative);
  router.get('/campaigns/:id/creatives', ...admin, listCreatives);
  router.patch('/creatives/:id', ...admin, updateCreative);
  router.patch('/creatives/:id/review', ...admin, reviewCreative);
  router.delete('/creatives/:id', ...admin, deleteCreative);

  // ---- Admin: leads ----
  router.get('/leads', ...admin, listLeads);
  router.get('/leads/awaiting', ...admin, listAwaitingLeads);   // SLA (Stage 2)
  router.post('/leads/manual', ...admin, createManualLead);
  router.patch('/leads/:id/status', ...admin, updateLeadStatus);
  router.post('/leads/:id/draft-reply', ...admin, draftLeadReply);   // Stage 3: AI outreach draft
  router.get('/leads/:id/messages', ...admin, getLeadThread);        // Stage 3.5: conversation thread
  router.post('/leads/:id/messages', ...admin, postLeadMessage);     // Stage 3.5: admin manual reply
  router.post('/leads/:id/auto-answer', ...admin, autoAnswerLead);   // Stage 3.5: trigger AI reply
  router.get('/leads/:id/activities', ...admin, getLeadActivities);  // lead-tracking P1: timeline
  router.post('/leads/:id/activities', ...admin, logLeadActivity);   // lead-tracking P1: log note/call
  router.post('/leads/:id/email', ...admin, emailLead);              // lead-tracking P2: tracked email send

  // ---- Admin: ad-program enrollment requests ----
  router.get('/enrollments', ...admin, listEnrollments);
  router.post('/enrollments/:shopId/decide', ...admin, decideEnrollment);

  // ---- Shop: own read-only + self-serve enrollment ----
  router.get('/shop/campaigns', ...shop, listShopCampaigns);
  router.get('/shop/capacity', ...shop, getShopCapacity);               // tier limit vs. used (§9.5)
  router.get('/shop/campaigns/:id/performance', ...shop, getShopCampaignPerformance);
  router.get('/shop/ad-channels', ...shop, getAdChannels);              // multi-channel: brief channel picker eligibility
  router.get('/shop/leads', ...shop, listShopLeads);
  router.patch('/shop/leads/:id/status', ...shop, updateShopLeadStatus); // shop works its own leads
  router.get('/shop/leads/awaiting', ...shop, listShopAwaitingLeads);   // SLA (Stage 2)
  // Shop lead follow-up (ownership-gated): timeline, log call/note, tracked email.
  router.get('/shop/leads/:id/activities', ...shop, getShopLeadActivities);
  router.post('/shop/leads/:id/activities', ...shop, logShopLeadActivity);
  router.post('/shop/leads/:id/email', ...shop, emailShopLead);
  router.get('/shop/enrollment', ...shop, getMyEnrollment);             // "Request ads" status
  router.post('/shop/enrollment', ...shop, requestAds);                 // "Request ads" opt-in
  router.get('/shop/messages', ...shop, getMyMessages);                 // durable thread (Phase 2)
  router.post('/shop/messages', ...shop, postMyMessage);
  router.get('/shop/campaign-requests', ...shop, listMyCampaignRequests); // recurring requests (Phase 3)
  router.post('/shop/campaign-requests', ...shop, submitCampaignRequest);
  router.get('/shop/subscription', ...shop, getMySubscription);          // self-serve tier (Phase 4)
  router.post('/shop/subscription/change', ...shop, changeMyTier);
  router.post('/shop/subscription/cancel', ...shop, cancelMySubscription);

  // ---- Shop: Connect Meta (Stage-4 connect slice; gated by ADS_META_CONNECT_ENABLED) ----
  router.get('/shop/meta/connect', ...shop, getMetaConnectUrl);          // → OAuth dialog URL
  router.get('/shop/meta/connection', ...shop, getMyMetaConnection);     // current status
  router.get('/shop/meta/accounts', ...shop, listMyMetaAccounts);        // ad accounts + Pages picker
  router.post('/shop/meta/select', ...shop, selectMyMetaAccount);        // store choice + flip §9.6 gate
  router.post('/shop/meta/disconnect', ...shop, disconnectMyMeta);

  return router;
}
