// backend/src/domains/agency/index.ts
import { DomainModule } from '../types';
import { logger } from '../../utils/logger';
import agencyRoutes from './routes';

export class AgencyDomain implements DomainModule {
  name = 'agency';
  routes = agencyRoutes;

  async initialize(): Promise<void> {
    logger.info('Agency domain initialized');
  }

  async cleanup(): Promise<void> {
    logger.info('Agency domain shutdown');
  }
}
