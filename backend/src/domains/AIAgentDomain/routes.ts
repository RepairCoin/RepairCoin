// backend/src/domains/AIAgentDomain/routes.ts
import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { previewAIReply } from './controllers/PreviewController';
import { getOwnShopSpend, getAdminCostSummary } from './controllers/SpendController';
import {
  getOwnShopAiSettings,
  updateOwnShopAiSettings,
  listShopAiSettings,
  adminUpdateShopAiSettings,
} from './controllers/SettingsController';

/**
 * AI Agent domain routes.
 *
 * Mounted at /api/ai by DomainRegistry (registered in app.ts).
 *
 * Endpoints:
 *   GET  /api/ai/health        — public skeleton-status check
 *   POST /api/ai/preview       — shop/admin: live preview of AI reply for a service
 *   GET  /api/ai/spend         — shop: own monthly spend snapshot (Task 12)
 *   GET  /api/ai/settings      — shop: own AI settings snapshot
 *   PUT  /api/ai/settings      — shop: update own shop-editable AI settings
 *   GET  /api/ai/admin/cost-summary — admin: platform-wide aggregate (Task 12)
 */

export function initializeRoutes(): Router {
  const router = Router();

  // Public sanity endpoint. No auth — confirms the domain is registered and
  // reachable. Returns skeleton metadata so a curl/health-check can confirm
  // the AI domain is live without exposing anything sensitive.
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      domain: 'ai',
      status: 'live',
      phase: '3',
      endpoints: [
        'GET /api/ai/health',
        'POST /api/ai/preview',
        'GET /api/ai/spend',
        'GET /api/ai/admin/cost-summary',
      ],
    });
  });

  // Task 6 — Live AI preview for the shop dashboard.
  // Auth: shop OR admin role required at the route level. Per-service
  // ownership check happens inside the controller (shop must own the service).
  router.post(
    '/preview',
    authMiddleware,
    requireRole(['shop', 'admin']),
    previewAIReply
  );

  // Task 12 — Spend monitoring.
  // Shop endpoint: returns the requesting shop's own monthly spend. Auth
  // gates on `shop` role; controller reads shopId from the JWT (no path
  // param, so a shop can never request another shop's spend).
  router.get('/spend', authMiddleware, requireRole(['shop']), getOwnShopSpend);

  // Shop-side AI settings. Both gate on `shop` role; the controller reads
  // shopId from the JWT (no path param) so a shop can only ever read/write
  // its own settings. PUT touches only the shop-editable fields.
  router.get('/settings', authMiddleware, requireRole(['shop']), getOwnShopAiSettings);
  router.put('/settings', authMiddleware, requireRole(['shop']), updateOwnShopAiSettings);

  // Admin endpoint: platform-wide aggregate. Mounted under /admin to make
  // the auth boundary explicit. Pure read — safe for admin dashboards.
  router.get(
    '/admin/cost-summary',
    authMiddleware,
    requireRole(['admin']),
    getAdminCostSummary
  );

  // Admin gate — per-shop AI capability controls. List every shop's AI
  // settings, and set the gate fields (AI on/off, follow-ups on/off,
  // monthly budget) for one shop.
  router.get(
    '/admin/shop-settings',
    authMiddleware,
    requireRole(['admin']),
    listShopAiSettings
  );
  router.put(
    '/admin/shop-settings/:shopId',
    authMiddleware,
    requireRole(['admin']),
    adminUpdateShopAiSettings
  );

  return router;
}
