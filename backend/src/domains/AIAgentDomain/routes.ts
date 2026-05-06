// backend/src/domains/AIAgentDomain/routes.ts
import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { previewAIReply } from './controllers/PreviewController';

/**
 * AI Agent domain routes.
 *
 * Mounted at /api/ai by DomainRegistry (registered in app.ts).
 *
 * Endpoints:
 *   GET  /api/ai/health   — public skeleton-status check
 *   POST /api/ai/preview  — shop/admin: live preview of AI reply for a service
 *
 * Future endpoints (not yet implemented):
 *   - Task 8: customer message handling fires via MessageService hook (no HTTP route)
 *   - Task 12: GET /api/ai/spend  — per-shop spend monitoring
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
      endpoints: ['GET /api/ai/health', 'POST /api/ai/preview'],
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

  return router;
}
