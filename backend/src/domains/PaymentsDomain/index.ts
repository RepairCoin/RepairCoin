// backend/src/domains/PaymentsDomain/index.ts
//
// Payments & Invoicing Center. DDD domain mounted at /api/payments. Phase 0 lays the
// foundation: the fiat `payments` ledger + Stripe webhook reconcile (source of truth).
// Transactions/Invoices/Payouts/etc. UIs arrive in Phase 1. See docs/PAYMENTS_INVOICING_PLAN.md.

import { Router } from 'express';
import { DomainModule } from '../types';
import { initializeRoutes } from './routes';
import { logger } from '../../utils/logger';

export class PaymentsDomain implements DomainModule {
  name = 'payments';
  routes: Router;

  constructor() {
    this.routes = initializeRoutes();
  }

  async initialize(): Promise<void> {
    logger.info(`${this.name} domain initialized — Payments & Invoicing Center`);
  }
}
