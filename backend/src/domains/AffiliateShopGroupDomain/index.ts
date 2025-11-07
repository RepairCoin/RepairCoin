// backend/src/domains/AffiliateShopGroupDomain/index.ts
import { DomainModule } from '../types';
import routes from './routes';
import { logger } from '../../utils/logger';

export class AffiliateShopGroupDomain implements DomainModule {
  name = 'affiliate-shop-groups';
  routes = routes;

  async initialize(): Promise<void> {
    logger.info(`${this.name} initialized`);
  }
}
