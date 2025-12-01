import { DomainModule } from '../types';
import { initializeRoutes } from './routes';
import { logger } from '../../utils/logger';
import { Router } from 'express';

export class MarketingDomain implements DomainModule {
  name = 'marketing';
  routes: Router;

  constructor() {
    this.routes = initializeRoutes();
  }

  async initialize(): Promise<void> {
    logger.info(`${this.name} domain initialized - Marketing Campaigns ready`);
  }
}
