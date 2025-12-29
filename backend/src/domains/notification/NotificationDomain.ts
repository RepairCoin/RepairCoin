import { DomainModule } from '../types';
import { eventBus } from '../../events/EventBus';
import { logger } from '../../utils/logger';
import notificationRoutes from './routes/index';
import { NotificationService } from './services/NotificationService';
import { WebSocketManager } from '../../services/WebSocketManager';

export class NotificationDomain implements DomainModule {
  name = 'notifications';
  routes = notificationRoutes;
  private notificationService!: NotificationService;
  private wsManager!: WebSocketManager;

  async initialize(): Promise<void> {
    this.notificationService = new NotificationService();
    this.setupEventSubscriptions();
    logger.info('Notification domain initialized');
  }

  // Set WebSocket manager (called after server initialization)
  public setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
    logger.info('WebSocket manager attached to NotificationDomain');
  }

  private setupEventSubscriptions(): void {
    // Listen to reward issued events
    eventBus.subscribe('shop:reward_issued', this.handleRewardIssued.bind(this), 'NotificationDomain');

    // Listen to redemption approval request events
    eventBus.subscribe('token:redemption_approval_requested', this.handleRedemptionApprovalRequest.bind(this), 'NotificationDomain');

    // Listen to redemption approval response events
    eventBus.subscribe('token:redemption_approved', this.handleRedemptionApproved.bind(this), 'NotificationDomain');
    eventBus.subscribe('token:redemption_rejected', this.handleRedemptionRejected.bind(this), 'NotificationDomain');
    eventBus.subscribe('token:redemption_cancelled', this.handleRedemptionCancelled.bind(this), 'NotificationDomain');

    // Listen to token gifted events
    eventBus.subscribe('customer:token_gifted', this.handleTokenGifted.bind(this), 'NotificationDomain');

    // Listen to subscription events
    eventBus.subscribe('subscription:cancelled', this.handleSubscriptionCancelled.bind(this), 'NotificationDomain');
    eventBus.subscribe('subscription:self_cancelled', this.handleSubscriptionSelfCancelled.bind(this), 'NotificationDomain');
    eventBus.subscribe('subscription:paused', this.handleSubscriptionPaused.bind(this), 'NotificationDomain');
    eventBus.subscribe('subscription:resumed', this.handleSubscriptionResumed.bind(this), 'NotificationDomain');
    eventBus.subscribe('subscription:reactivated', this.handleSubscriptionReactivated.bind(this), 'NotificationDomain');

    logger.info('Notification domain event subscriptions set up');
  }

  private async handleRewardIssued(event: any): Promise<void> {
    try {
      const { shopAddress, customerAddress, shopName, amount, transactionId } = event.data;

      logger.info(`Creating reward issued notification: ${amount} RCN from ${shopName} to ${customerAddress}`);

      const notification = await this.notificationService.createRewardIssuedNotification(
        shopAddress,
        customerAddress,
        shopName,
        amount,
        transactionId
      );

      // Send real-time notification via WebSocket if user is connected
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(customerAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling reward issued event:', error);
    }
  }

  private async handleRedemptionApprovalRequest(event: any): Promise<void> {
    try {
      const { shopAddress, customerAddress, shopName, amount, redemptionSessionId } = event.data;

      logger.info(`Creating redemption approval request notification: ${amount} RCN from ${shopName} to ${customerAddress}`);

      const notification = await this.notificationService.createRedemptionApprovalRequest(
        shopAddress,
        customerAddress,
        shopName,
        amount,
        redemptionSessionId
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(customerAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling redemption approval request event:', error);
    }
  }

  private async handleRedemptionApproved(event: any): Promise<void> {
    try {
      const { customerAddress, shopAddress, customerName, amount, redemptionSessionId } = event.data;

      logger.info(`Creating redemption approved notification: ${customerName} approved ${amount} RCN for ${shopAddress}`);

      const notification = await this.notificationService.createRedemptionResponseNotification(
        customerAddress,
        shopAddress,
        customerName,
        amount,
        redemptionSessionId,
        true
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling redemption approved event:', error);
    }
  }

  private async handleRedemptionRejected(event: any): Promise<void> {
    try {
      const { customerAddress, shopAddress, customerName, amount, redemptionSessionId } = event.data;

      logger.info(`Creating redemption rejected notification: ${customerName} rejected ${amount} RCN for ${shopAddress}`);

      const notification = await this.notificationService.createRedemptionResponseNotification(
        customerAddress,
        shopAddress,
        customerName,
        amount,
        redemptionSessionId,
        false
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling redemption rejected event:', error);
    }
  }

  private async handleRedemptionCancelled(event: any): Promise<void> {
    try {
      const { shopAddress, customerAddress, shopName, amount, redemptionSessionId } = event.data;

      logger.info(`Creating redemption cancelled notification: ${shopName} cancelled ${amount} RCN for ${customerAddress}`);

      const notification = await this.notificationService.createRedemptionCancelledNotification(
        shopAddress,
        customerAddress,
        shopName,
        amount,
        redemptionSessionId
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(customerAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling redemption cancelled event:', error);
    }
  }

  private async handleTokenGifted(event: any): Promise<void> {
    try {
      const { fromCustomerAddress, toCustomerAddress, fromCustomerName, amount, transactionId } = event.data;

      logger.info(`Creating token gifted notification: ${amount} RCN from ${fromCustomerName} to ${toCustomerAddress}`);

      const notification = await this.notificationService.createTokenGiftedNotification(
        fromCustomerAddress,
        toCustomerAddress,
        fromCustomerName,
        amount,
        transactionId
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(toCustomerAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling token gifted event:', error);
    }
  }

  private async handleSubscriptionCancelled(event: any): Promise<void> {
    try {
      const { shopAddress, reason, effectiveDate } = event.data;

      logger.info(`Creating subscription cancelled notification for ${shopAddress}`);

      const notification = await this.notificationService.createSubscriptionCancelledNotification(
        shopAddress,
        reason,
        effectiveDate
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling subscription cancelled event:', error);
    }
  }

  private async handleSubscriptionSelfCancelled(event: any): Promise<void> {
    try {
      const { shopAddress, reason, effectiveDate } = event.data;

      logger.info(`Creating subscription self-cancelled notification for ${shopAddress}`);

      const notification = await this.notificationService.createSubscriptionSelfCancelledNotification(
        shopAddress,
        reason,
        effectiveDate
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling subscription self-cancelled event:', error);
    }
  }

  private async handleSubscriptionPaused(event: any): Promise<void> {
    try {
      const { shopAddress, reason } = event.data;

      logger.info(`Creating subscription paused notification for ${shopAddress}`);

      const notification = await this.notificationService.createSubscriptionPausedNotification(
        shopAddress,
        reason
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling subscription paused event:', error);
    }
  }

  private async handleSubscriptionResumed(event: any): Promise<void> {
    try {
      const { shopAddress } = event.data;

      logger.info(`Creating subscription resumed notification for ${shopAddress}`);

      const notification = await this.notificationService.createSubscriptionResumedNotification(
        shopAddress
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling subscription resumed event:', error);
    }
  }

  private async handleSubscriptionReactivated(event: any): Promise<void> {
    try {
      const { shopAddress } = event.data;

      logger.info(`Creating subscription reactivated notification for ${shopAddress}`);

      const notification = await this.notificationService.createSubscriptionReactivatedNotification(
        shopAddress
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling subscription reactivated event:', error);
    }
  }
}
