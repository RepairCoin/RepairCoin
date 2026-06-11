// backend/src/domains/AdsDomain/index.ts
//
// Ads System (Stage 0 — foundation). DDD domain mounted at /api/ads. Stage 0
// ships schema + role-scoped CRUD; ROI/safeguard/attribution logic is Stage 1-2.
// See docs/tasks/strategy/ads-system/.

import { DomainModule } from '../types';
import { initializeRoutes } from './routes';
import { logger } from '../../utils/logger';
import { Router } from 'express';

export class AdsDomain implements DomainModule {
  name = 'ads';
  routes: Router;

  constructor() {
    this.routes = initializeRoutes();
  }

  async initialize(): Promise<void> {
    logger.info(`${this.name} domain initialized — Ads System (Stage 0 foundation)`);
  }
}
