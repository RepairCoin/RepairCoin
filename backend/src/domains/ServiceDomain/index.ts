// backend/src/domains/ServiceDomain/index.ts
import { DomainModule } from '../types';
import { initializeRoutes } from './routes';
import { getStripeService } from '../../services/StripeService';
import { logger } from '../../utils/logger';
import { Router } from 'express';

export class ServiceDomain implements DomainModule {
  name = 'services';
  routes: Router;

  constructor() {
    // Initialize routes with StripeService
    const stripeService = getStripeService();
    this.routes = initializeRoutes(stripeService);
  }

  async initialize(): Promise<void> {
    logger.info(`${this.name} domain initialized - Service Marketplace ready`);
  }
}
