// backend/src/domains/InventoryDomain/index.ts
import { DomainModule } from '../types';
import { initializeRoutes } from './routes';
import { logger } from '../../utils/logger';
import { Router } from 'express';
import { setupServiceCompletionListener } from './controllers/serviceIntegrationController';
import { getLowStockAlertScheduler } from '../../services/LowStockAlertScheduler';

export class InventoryDomain implements DomainModule {
  name = 'inventory';
  routes: Router;

  constructor() {
    this.routes = initializeRoutes();
  }

  async initialize(): Promise<void> {
    // Setup service completion event listener for auto stock deduction
    setupServiceCompletionListener();

    // Start low stock alert scheduler in production
    if (process.env.NODE_ENV === 'production' || process.env.LOW_STOCK_ALERTS_ENABLED === 'true') {
      const scheduler = getLowStockAlertScheduler();
      scheduler.start();
      logger.info('Low stock alert scheduler started');
    }

    logger.info(`${this.name} domain initialized - Inventory Management ready`);
  }
}
