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
  createCreative, listCreatives, updateCreative, reviewCreative,
} from './controllers/CreativeController';
import {
  listLeads, createManualLead, updateLeadStatus, listShopLeads,
} from './controllers/LeadController';
import {
  getCampaignPerformance, getShopCampaignPerformance,
} from './controllers/PerformanceController';

export function initializeRoutes(): Router {
  const router = Router();
  const admin = [authMiddleware, requireRole(['admin'])];
  const shop = [authMiddleware, requireRole(['shop'])];

  // Health — confirms the domain is registered.
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ domain: 'ads', status: 'live', stage: '0' });
  });

  // ---- Admin: campaigns ----
  router.post('/campaigns', ...admin, createCampaign);
  router.get('/campaigns', ...admin, listCampaigns);
  router.get('/campaigns/:id', ...admin, getCampaign);
  router.patch('/campaigns/:id', ...admin, updateCampaign);
  router.delete('/campaigns/:id', ...admin, deleteCampaign);
  router.get('/campaigns/:id/performance', ...admin, getCampaignPerformance);

  // ---- Admin: creatives ----
  router.post('/campaigns/:id/creatives', ...admin, createCreative);
  router.get('/campaigns/:id/creatives', ...admin, listCreatives);
  router.patch('/creatives/:id', ...admin, updateCreative);
  router.patch('/creatives/:id/review', ...admin, reviewCreative);

  // ---- Admin: leads ----
  router.get('/leads', ...admin, listLeads);
  router.post('/leads/manual', ...admin, createManualLead);
  router.patch('/leads/:id/status', ...admin, updateLeadStatus);

  // ---- Shop: own read-only ----
  router.get('/shop/campaigns', ...shop, listShopCampaigns);
  router.get('/shop/campaigns/:id/performance', ...shop, getShopCampaignPerformance);
  router.get('/shop/leads', ...shop, listShopLeads);

  return router;
}
