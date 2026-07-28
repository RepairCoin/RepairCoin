import { Router, Request, Response } from 'express';

/**
 * Payments & Invoicing Center routes, mounted at /api/payments.
 * Phase 0 is foundation-only (ledger + webhook reconcile); shop-facing reads (transactions,
 * invoices, payouts) arrive in Phase 1. For now this exposes just a health probe.
 */
export function initializeRoutes(): Router {
  const router = Router();

  router.get('/_health', (_req: Request, res: Response) => {
    res.json({ success: true, domain: 'payments', status: 'ok' });
  });

  return router;
}
