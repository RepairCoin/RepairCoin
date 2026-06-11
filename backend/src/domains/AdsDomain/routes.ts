// backend/src/domains/AdsDomain/routes.ts
//
// Ads routes, mounted at /api/ads by DomainRegistry. Admin = requireRole(['admin']);
// shop = requireRole(['shop']) with shopId sourced from the JWT (never a path param).
// Per Stage-0 scope: super_admin/ads_manager collapse to 'admin'; no 'employee' in v1.

import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import {
  createCampaign, listCampaigns, getCampaign, updateCampaign, deleteCampaign,
  listShopCampaigns,
} from './controllers/CampaignController';
import {
  createCreative, listCreatives, updateCreative, reviewCreative, deleteCreative,
} from './controllers/CreativeController';
import {
  listLeads, createManualLead, updateLeadStatus, listShopLeads, webformLead, draftLeadReply,
  listAwaitingLeads, listShopAwaitingLeads,
} from './controllers/LeadController';
import {
  getCampaignPerformance, getShopCampaignPerformance, enterDailyMetrics, getAllShopsSummary,
  getIndustryAnalytics, getCampaignMargin, getMarginSummary,
} from './controllers/PerformanceController';
import { verifyMetaWebhook, receiveMetaWebhook } from './controllers/MetaWebhookController';
import {
  createExperiment, listExperiments, getExperimentReport, setExperimentWinner,
} from './controllers/ExperimentController';
import { taxonomyFor } from './services/industryTaxonomies';

export function initializeRoutes(): Router {
  const router = Router();
  const admin = [authMiddleware, requireRole(['admin'])];
  const shop = [authMiddleware, requireRole(['shop'])];

  // Health — confirms the domain is registered.
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ domain: 'ads', status: 'live', stage: '2' });
  });

  // PUBLIC — landing-page lead webform (UTM-attributed). No auth: attribution is
  // by campaign id / utm params in the body. (Stage 2.)
  router.post('/leads/webform', webformLead);

  // PUBLIC — Meta Lead Ads webhook (Stage 4). GET = verification handshake;
  // POST = signed lead delivery (raw body parsed in app.ts for signature check).
  router.get('/webhooks/meta/leads', verifyMetaWebhook);
  router.post('/webhooks/meta/leads', receiveMetaWebhook);

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

  // ---- Shop: own read-only ----
  router.get('/shop/campaigns', ...shop, listShopCampaigns);
  router.get('/shop/campaigns/:id/performance', ...shop, getShopCampaignPerformance);
  router.get('/shop/leads', ...shop, listShopLeads);
  router.get('/shop/leads/awaiting', ...shop, listShopAwaitingLeads);   // SLA (Stage 2)

  return router;
}
