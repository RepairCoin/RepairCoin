// backend/src/domains/ShopGroupDomain/index.ts
import { DomainModule } from '../types';
import routes from './routes';

export class ShopGroupDomain implements DomainModule {
  name = 'shop-groups';
  routes = routes;

  async initialize(): Promise<void> {
    console.log(`✅ ${this.name} initialized`);
  }
}
