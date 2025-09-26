import { DomainModule } from '../types';
import { eventBus, createDomainEvent } from '../../events/EventBus';
import { logger } from '../../utils/logger';
import adminRoutes from './routes/admin'; 
import { AdminService } from './services/AdminService';
import { adminSyncService } from '../../services/AdminSyncService';

export class AdminDomain implements DomainModule {
  name = 'admin';
  routes = adminRoutes; // Use your existing admin routes
  private adminService!: AdminService;

  async initialize(): Promise<void> {
    this.adminService = new AdminService();
    
    // Sync admin addresses from environment variables
    try {
      logger.info('Syncing admin addresses from environment...');
      await adminSyncService.syncAdminsFromEnvironment();
      
      // Optionally clean up removed admins (keep them as regular admins)
      await adminSyncService.cleanupRemovedAdmins(true);
      
      // Log sync status
      const syncStatus = await adminSyncService.getSyncStatus();
      logger.info('Admin sync status:', {
        environmentAdmins: syncStatus.envAdmins.length,
        databaseAdmins: syncStatus.dbAdmins.length,
        needsSync: syncStatus.syncNeeded.length,
        toRemove: syncStatus.toRemove.length
      });
    } catch (error) {
      logger.error('Failed to sync admin addresses:', error);
      // Don't fail initialization if sync fails
    }
    
    this.setupEventSubscriptions();
    logger.info('Admin domain initialized');
  }

  private setupEventSubscriptions(): void {
    // Listen to all events for monitoring and analytics
    eventBus.subscribe('customer.registered', this.handleCustomerRegistered.bind(this), 'AdminDomain');
    eventBus.subscribe('token.minted', this.handleTokenMinted.bind(this), 'AdminDomain');
    eventBus.subscribe('token.redeemed', this.handleTokenRedeemed.bind(this), 'AdminDomain');
    eventBus.subscribe('webhook.repair_completed', this.handleWebhookProcessed.bind(this), 'AdminDomain');
    eventBus.subscribe('shop.verified', this.handleShopVerified.bind(this), 'AdminDomain');
  }

  private async handleCustomerRegistered(event: any): Promise<void> {
    // Track customer registration metrics
    logger.info('Admin domain: Customer registered', {
      customerAddress: event.aggregateId,
      timestamp: event.timestamp
    });

    // Could trigger welcome emails, update dashboards, etc.
    await this.adminService.updatePlatformMetrics('customer_registered');
  }

  private async handleTokenMinted(event: any): Promise<void> {
    // Track token issuance for platform analytics
    logger.info('Admin domain: Tokens minted', {
      customerAddress: event.aggregateId,
      amount: event.data.amount,
      reason: event.data.reason
    });

    await this.adminService.updatePlatformMetrics('tokens_minted', event.data.amount);
  }

  private async handleTokenRedeemed(event: any): Promise<void> {
    // Track redemptions for platform analytics
    logger.info('Admin domain: Tokens redeemed', {
      customerAddress: event.aggregateId,
      shopId: event.data.shopId,
      amount: event.data.amount
    });

    await this.adminService.updatePlatformMetrics('tokens_redeemed', event.data.amount);
  }

  private async handleWebhookProcessed(event: any): Promise<void> {
    // Monitor webhook processing for system health
    logger.info('Admin domain: Webhook processed', {
      event: event.type,
      success: event.data.success
    });

    if (!event.data.success) {
      // Alert on webhook failures
      await this.adminService.alertOnWebhookFailure(event.data);
    }
  }

  private async handleShopVerified(event: any): Promise<void> {
    // Track shop verifications
    logger.info('Admin domain: Shop verified', {
      shopId: event.aggregateId
    });

    await this.adminService.updatePlatformMetrics('shop_verified');
  }

  async cleanup(): Promise<void> {
    // Cleanup admin resources if needed
    logger.info('Admin domain cleanup completed');
  }
}