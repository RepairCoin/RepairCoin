// backend/src/domains/customer/CustomerDomain.ts
import { DomainModule } from '../types';
import { eventBus, createDomainEvent } from '../../events/EventBus';
import { logger } from '../../utils/logger';
import customerRoutes from './routes';
import { CustomerService } from './services/CustomerService';

export class CustomerDomain implements DomainModule {
  name = 'customers';
  routes = customerRoutes;
  private customerService!: CustomerService;

  async initialize(): Promise<void> {
    // Initialize service
    this.customerService = new CustomerService();
    
    // Subscribe to events from other domains
    this.setupEventSubscriptions();
    
    logger.info('Customer domain initialized');
  }

  private setupEventSubscriptions(): void {
    // Listen to token events
    eventBus.subscribe('token.minted', this.handleTokenMinted.bind(this), 'CustomerDomain');
    eventBus.subscribe('token.redeemed', this.handleTokenRedeemed.bind(this), 'CustomerDomain');
    
    // Listen to webhook events
    eventBus.subscribe('webhook.repair_completed', this.handleRepairCompleted.bind(this), 'CustomerDomain');
    eventBus.subscribe('webhook.referral_verified', this.handleReferralVerified.bind(this), 'CustomerDomain');
  }

  private async handleTokenMinted(event: any): Promise<void> {
    logger.info('Customer domain handling token minted event', {
      customerAddress: event.aggregateId,
      amount: event.data.amount
    });

    // Update customer statistics or trigger notifications
    // This keeps customer data in sync when tokens are minted
  }

  private async handleTokenRedeemed(event: any): Promise<void> {
    logger.info('Customer domain handling token redemption event', {
      customerAddress: event.aggregateId,
      amount: event.data.amount,
      shopId: event.data.shopId
    });

    // Could update customer redemption history or preferences
  }

  private async handleRepairCompleted(event: any): Promise<void> {
    const { customer_wallet_address, repair_amount, shop_id } = event.data;
    
    logger.info('Customer domain handling repair completion', {
      customerAddress: customer_wallet_address,
      repairAmount: repair_amount,
      shopId: shop_id
    });

    // Ensure customer exists before token minting
    await this.customerService.ensureCustomerExists(customer_wallet_address);
    
    // Publish customer-updated event
    await eventBus.publish(createDomainEvent(
      'customer.repair_recorded',
      customer_wallet_address,
      { repairAmount: repair_amount, shopId: shop_id },
      'CustomerDomain'
    ));
  }

  private async handleReferralVerified(event: any): Promise<void> {
    const { referrer_wallet_address, referee_wallet_address } = event.data;
    
    logger.info('Customer domain handling referral verification', {
      referrer: referrer_wallet_address,
      referee: referee_wallet_address
    });

    // Update referral counts
    await this.customerService.updateReferralCount(referrer_wallet_address);
    
    // Publish referral events
    await eventBus.publish(createDomainEvent(
      'customer.referral_made',
      referrer_wallet_address,
      { referee: referee_wallet_address },
      'CustomerDomain'
    ));
  }

  async cleanup(): Promise<void> {
    // Cleanup resources if needed
    logger.info('Customer domain cleanup completed');
  }
}
