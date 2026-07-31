import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole, requireAdmin } from '../../middleware/auth';
import { requireShopPermission } from '../../middleware/permissions';
import { listTransactions, getTransaction, exportTransactions } from './controllers/TransactionController';
import { refundTransaction, listRefunds } from './controllers/RefundController';
import {
  listAllTransactions,
  getTransactionAdmin,
  listRefundsAdmin,
  getTransactionTotals,
  exportAllTransactions,
} from './controllers/AdminTransactionController';
import { refundTransactionAdmin } from './controllers/AdminRefundController';

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

  // Issuing a refund moves money out, so it needs its own permission — payments:manage only
  // grants read. Owners hold it by default; managers do not unless explicitly granted.
  const refundGuard = [authMiddleware, requireRole(['shop']), requireShopPermission('payments:refund')];

  // Platform-wide oversight (Slice A1) — admin role, no shop scope. These MUST come before the
  // shop `/transactions/:id` route or Express matches "admin" as an id, the same trap as
  // /export.csv below.
  const adminGuard = [authMiddleware, requireAdmin];

  router.get('/admin/transactions/export.csv', ...adminGuard, exportAllTransactions);
  router.get('/admin/transactions/summary', ...adminGuard, getTransactionTotals);
  router.get('/admin/transactions/:id/refunds', ...adminGuard, listRefundsAdmin);
  // Slice A2 — the one admin write. Direct charges, so this debits the SHOP's Stripe balance,
  // not the platform's; the controller mandates a note and notifies the shop.
  router.post('/admin/transactions/:id/refund', ...adminGuard, refundTransactionAdmin);
  router.get('/admin/transactions/:id', ...adminGuard, getTransactionAdmin);
  router.get('/admin/transactions', ...adminGuard, listAllTransactions);

  // /export.csv MUST be declared before /:id — otherwise Express matches it as an id.
  router.get('/transactions/export.csv', ...shopGuard, exportTransactions);
  router.get('/transactions/:id/refunds', ...shopGuard, listRefunds);
  router.post('/transactions/:id/refund', ...refundGuard, refundTransaction);
  router.get('/transactions/:id', ...shopGuard, getTransaction);
  router.get('/transactions', ...shopGuard, listTransactions);

  return router;
}
