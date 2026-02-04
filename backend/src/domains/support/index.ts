// backend/src/domains/support/index.ts
import { DomainModule } from '../types';
import { logger } from '../../utils/logger';
import supportRoutes from './routes';

export class SupportDomain implements DomainModule {
  name = 'support';
  routes = supportRoutes;

  async initialize(): Promise<void> {
    logger.info('Support domain initialized');
    logger.info('Support chat system ready for shop-to-admin communication');
  }

  async shutdown(): Promise<void> {
    logger.info('Support domain shutdown');
  }
}
