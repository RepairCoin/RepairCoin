// backend/src/domains/AffiliateShopGroupDomain/index.ts
import { DomainModule } from '../types';
import routes from './routes';

export class AffiliateShopGroupDomain implements DomainModule {
  name = 'affiliate-shop-groups';
  routes = routes;

  async initialize(): Promise<void> {
    console.log(`✅ ${this.name} initialized`);
  }
}
