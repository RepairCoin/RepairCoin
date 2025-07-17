import { DomainModule } from '../types';
import { eventBus, createDomainEvent } from '../../events/EventBus';
import { logger } from '../../utils/logger';
import shopRoutes from './routes/index'; // Use domain-based route
import { ShopService } from './services/ShopService';

export class ShopDomain implements DomainModule {
  name = 'shops';
  routes = shopRoutes; // Use your existing shops route
  private shopService!: ShopService;

  async initialize(): Promise<void> {
    this.shopService = new ShopService();
    this.setupEventSubscriptions();
    logger.info('Shop domain initialized');
  }

  private setupEventSubscriptions(): void {
    // Listen to token events to update shop statistics
    eventBus.subscribe('token.minted', this.handleTokenMinted.bind(this), 'ShopDomain');
    eventBus.subscribe('token.redeemed', this.handleTokenRedeemed.bind(this), 'ShopDomain');
  }

  private async handleTokenMinted(event: any): Promise<void> {
    // Update shop statistics when tokens are minted
    if (event.data.shopId && event.data.shopId !== 'admin_system') {
      await this.shopService.updateTokenStats(event.data.shopId, event.data.amount, 'minted');
    }
  }

  private async handleTokenRedeemed(event: any): Promise<void> {
    // Update shop statistics when tokens are redeemed
    if (event.data.shopId) {
      await this.shopService.updateTokenStats(event.data.shopId, event.data.amount, 'redeemed');
    }
  }
}