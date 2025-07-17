import { DomainModule } from '../types';
import { eventBus, createDomainEvent } from '../../events/EventBus';
import { logger } from '../../utils/logger';
import tokenRoutes from './routes';
import { TokenService } from './services/TokenService';

export class TokenDomain implements DomainModule {
  name = 'tokens';
  routes = tokenRoutes;
  private tokenService!: TokenService;

  async initialize(): Promise<void> {
    this.tokenService = new TokenService();
    this.setupEventSubscriptions();
    logger.info('Token domain initialized');
  }

  private setupEventSubscriptions(): void {
    // Listen to customer events
    eventBus.subscribe('customer.registered', this.handleCustomerRegistered.bind(this), 'TokenDomain');
    eventBus.subscribe('customer.repair_recorded', this.handleRepairRecorded.bind(this), 'TokenDomain');
    
    // Listen to webhook events
    eventBus.subscribe('webhook.repair_completed', this.handleRepairCompleted.bind(this), 'TokenDomain');
    eventBus.subscribe('webhook.referral_verified', this.handleReferralVerified.bind(this), 'TokenDomain');
  }

  private async handleCustomerRegistered(event: any): Promise<void> {
    // Maybe mint welcome tokens
    logger.info('Token domain: New customer registered', {
      customerAddress: event.aggregateId
    });
    
    // Could mint welcome bonus here
    // await this.tokenService.mintWelcomeBonus(event.aggregateId);
  }

  private async handleRepairRecorded(event: any): Promise<void> {
    // This is where the actual token minting happens
    const { repairAmount, shopId } = event.data;
    
    try {
      const result = await this.tokenService.processRepairEarning(
        event.aggregateId, // customer address
        repairAmount,
        shopId
      );

      if (result.success) {
        // Publish token minted event
        await eventBus.publish(createDomainEvent(
          'token.minted',
          event.aggregateId,
          {
            amount: result.tokensToMint,
            reason: 'repair_completion',
            transactionHash: result.transactionHash,
            newTier: result.newTier
          },
          'TokenDomain'
        ));
      }
    } catch (error) {
      logger.error('Failed to process repair earning:', error);
    }
  }

  private async handleRepairCompleted(event: any): Promise<void> {
    // Direct webhook processing (backup)
    logger.info('Token domain handling direct webhook repair completion');
  }

  private async handleReferralVerified(event: any): Promise<void> {
    const { referrer_wallet_address, referee_wallet_address } = event.data;
    
    try {
      const result = await this.tokenService.processReferralReward(
        referrer_wallet_address,
        referee_wallet_address
      );

      if (result.success) {
        await eventBus.publish(createDomainEvent(
          'token.referral_minted',
          referrer_wallet_address,
          {
            referrer: referrer_wallet_address,
            referee: referee_wallet_address,
            transactionHash: result.transactionHash
          },
          'TokenDomain'
        ));
      }
    } catch (error) {
      logger.error('Failed to process referral reward:', error);
    }
  }
}
