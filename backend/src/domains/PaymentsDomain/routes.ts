import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { requireShopPermission } from '../../middleware/permissions';
import { listTransactions, getTransaction, exportTransactions } from './controllers/TransactionController';

/**
 * Payments & Invoicing Center routes, mounted at /api/payments.
 * Launch scope is Transactions (Slice 1.2) + Refunds (1.3); invoices, links, payouts and the
 * revenue dashboard are Phase 2. shopId always comes from the JWT, never from the path.
 */
export function initializeRoutes(): Router {
  const router = Router();

  router.get('/_health', (_req: Request, res: Response) => {
    res.json({ success: true, domain: 'payments', status: 'ok' });
  });

  const shopGuard = [authMiddleware, requireRole(['shop']), requireShopPermission('payments:manage')];

  // /export.csv MUST be declared before /:id — otherwise Express matches it as an id.
  router.get('/transactions/export.csv', ...shopGuard, exportTransactions);
  router.get('/transactions/:id', ...shopGuard, getTransaction);
  router.get('/transactions', ...shopGuard, listTransactions);

  return router;
}
