// backend/src/domains/InventoryDomain/index.ts
import { DomainModule } from '../types';
import { initializeRoutes } from './routes';
import { logger } from '../../utils/logger';
import { Router } from 'express';

export class InventoryDomain implements DomainModule {
  name = 'inventory';
  routes: Router;

  constructor() {
    this.routes = initializeRoutes();
  }

  async initialize(): Promise<void> {
    logger.info(`${this.name} domain initialized - Inventory Management ready`);
  }
}
