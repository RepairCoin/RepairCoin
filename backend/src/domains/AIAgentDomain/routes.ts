// backend/src/domains/AIAgentDomain/routes.ts
import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { previewAIReply } from './controllers/PreviewController';
import { suggestServiceFaqs } from './controllers/FaqSuggestionController';
import { getOwnShopSpend, getAdminCostSummary } from './controllers/SpendController';
import {
  getOwnShopAiSettings,
  updateOwnShopAiSettings,
  listShopAiSettings,
  adminUpdateShopAiSettings,
} from './controllers/SettingsController';
import { getMetrics } from './controllers/MetricsController';
import { askHelp } from './controllers/HelpAssistantController';
import {
  listHelpArticles,
  getHelpArticle,
} from './controllers/HelpArticleController';
import { askInsights } from './controllers/InsightsController';
import {
  listAnomalies,
  dismissAnomaly,
} from './controllers/InsightsAnomaliesController';

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
 *   GET  /api/ai/metrics       — shop: own AI Impact Metrics
 *   POST /api/ai/help          — shop: How-To Assistant (in-dashboard product help)
 *   GET  /api/ai/help/articles — shop: list help-article index (filename + title)
 *   GET  /api/ai/help/articles/:filename — shop: one help article body
 *   POST /api/ai/insights      — shop: Business-Data Insights assistant (Sonnet + tools)
 *   GET  /api/ai/insights/anomalies         — shop: list active anomaly banners
 *   POST /api/ai/insights/anomalies/:id/dismiss — shop: dismiss one anomaly
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

  // AI-suggested FAQ entries for a service. Route gates on shop/admin role;
  // the controller does the per-service ownership check.
  router.post(
    '/services/:serviceId/faq-suggestions',
    authMiddleware,
    requireRole(['shop', 'admin']),
    suggestServiceFaqs
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

  // Shop-side AI Impact Metrics — Phase 2. Same auth shape as /settings:
  // gates on `shop` role; the controller reads shopId from the JWT (no
  // path param) so a shop can only ever read its OWN metrics.
  // Query: ?range=7d|30d|90d|all  (default 30d)
  router.get('/metrics', authMiddleware, requireRole(['shop']), getMetrics);

  // How-To Assistant — shop-owner in-dashboard product help AI.
  // Body: { sessionId, messages: [{ role, content }, ...] }. The
  // controller reads shopId from the JWT (no path param), spend-caps
  // against the shop's monthly budget (shared with the AI Sales Agent),
  // and audits each call into ai_help_messages.
  router.post('/help', authMiddleware, requireRole(['shop']), askHelp);

  // Help article expansion. The chat assistant cites titles in a
  // *Related:* footer; the panel fetches the index on mount and the
  // body on click. Both shop-role guarded — same audience as /help.
  router.get(
    '/help/articles',
    authMiddleware,
    requireRole(['shop']),
    listHelpArticles
  );
  router.get(
    '/help/articles/:filename',
    authMiddleware,
    requireRole(['shop']),
    getHelpArticle
  );

  // Business-Data Insights assistant — shop-owner "Ask about your
  // business" AI. Body: { sessionId, messages: [{ role, content }, ...] }.
  // Sonnet + tool-use; tools query the requesting shop's data via
  // hardcoded shop-scoped SQL (shopId sourced from the JWT, never
  // from Claude args). Spend-capped against the shared monthly budget
  // and audited into ai_insights_messages with the tool_calls JSONB.
  router.post('/insights', authMiddleware, requireRole(['shop']), askInsights);

  // Phase 7.2 — nightly anomaly detection. Banner reads via GET on
  // panel mount; "Dismiss" tap soft-dismisses via POST. Both shop-
  // scoped via JWT — the controller never trusts URL/body for scope.
  router.get(
    '/insights/anomalies',
    authMiddleware,
    requireRole(['shop']),
    listAnomalies
  );
  router.post(
    '/insights/anomalies/:id/dismiss',
    authMiddleware,
    requireRole(['shop']),
    dismissAnomaly
  );

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
