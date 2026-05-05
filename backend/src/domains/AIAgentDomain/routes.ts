// backend/src/domains/AIAgentDomain/routes.ts
import { Router, Request, Response } from 'express';

/**
 * AI Agent domain routes.
 *
 * Phase 3 Task 1: skeleton only — single health-check endpoint that proves
 * the domain is mounted and reachable. Real endpoints land in:
 *   - Task 6: POST /api/ai/preview   (shop-side live preview)
 *   - Task 8: customer message handling fires via MessageService hook
 *   - Task 12: GET /api/ai/spend     (per-shop spend monitoring)
 */

export function initializeRoutes(): Router {
  const router = Router();

  // Phase 3 Task 1 sanity endpoint. Public (no auth) — confirms the domain
  // is registered and reachable without exposing anything sensitive.
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      domain: 'ai',
      status: 'skeleton',
      phase: '3-task-1',
      message: 'AI Agent domain is registered. Real endpoints arrive in Tasks 6+.',
    });
  });

  return router;
}
