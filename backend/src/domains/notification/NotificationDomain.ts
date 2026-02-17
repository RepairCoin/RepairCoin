import { DomainModule } from '../types';
import { eventBus } from '../../events/EventBus';
import { logger } from '../../utils/logger';
import notificationRoutes from './routes/index';
import { NotificationService } from './services/NotificationService';
import { WebSocketManager } from '../../services/WebSocketManager';
import { getExpoPushService, ExpoPushService, NotificationChannels } from '../../services/ExpoPushService';
import { EmailService } from '../../services/EmailService';
import { CustomerRepository } from '../../repositories/CustomerRepository';

export class NotificationDomain implements DomainModule {
  name = 'notifications';
  routes = notificationRoutes;
  private notificationService!: NotificationService;
  private wsManager!: WebSocketManager;
  private expoPushService!: ExpoPushService;
  private emailService!: EmailService;
  private customerRepository!: CustomerRepository;

  // Get admin addresses from environment
  private getAdminAddresses(): string[] {
    const adminAddresses = process.env.ADMIN_ADDRESSES || '';
    return adminAddresses.split(',').map(addr => addr.trim().toLowerCase()).filter(Boolean);
  }

  async initialize(): Promise<void> {
    this.notificationService = new NotificationService();
    this.expoPushService = getExpoPushService();
    this.emailService = new EmailService();
    this.customerRepository = new CustomerRepository();
    this.setupEventSubscriptions();
    logger.info('Notification domain initialized with push notification support');
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

    // Listen to shop suspension events
    eventBus.subscribe('shop:suspended', this.handleShopSuspended.bind(this), 'NotificationDomain');
    eventBus.subscribe('shop:unsuspended', this.handleShopUnsuspended.bind(this), 'NotificationDomain');

    // Listen to reschedule request events
    eventBus.subscribe('reschedule:request_created', this.handleRescheduleRequestCreated.bind(this), 'NotificationDomain');
    eventBus.subscribe('reschedule:request_approved', this.handleRescheduleRequestApproved.bind(this), 'NotificationDomain');
    eventBus.subscribe('reschedule:request_rejected', this.handleRescheduleRequestRejected.bind(this), 'NotificationDomain');
    eventBus.subscribe('reschedule:request_expired', this.handleRescheduleRequestExpired.bind(this), 'NotificationDomain');

    // Listen to shop direct reschedule events
    eventBus.subscribe('booking:rescheduled_by_shop', this.handleBookingRescheduledByShop.bind(this), 'NotificationDomain');

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

      // Send push notification
      await this.expoPushService.sendRewardNotification(customerAddress, shopName, amount, transactionId);
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

      // Send push notification
      await this.expoPushService.sendRedemptionApprovalRequest(customerAddress, shopName, amount, redemptionSessionId);
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

      // Send push notification
      await this.expoPushService.sendTokenGiftedNotification(toCustomerAddress, fromCustomerName, amount, transactionId);
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

      // Send real-time notification via WebSocket to the shop
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);

        // Also notify admins so their dashboard can refresh
        const adminAddresses = this.getAdminAddresses();
        if (adminAddresses.length > 0) {
          this.wsManager.sendToAddresses(adminAddresses, {
            type: 'subscription_status_changed',
            payload: {
              shopAddress,
              action: 'self_cancelled',
              reason,
              effectiveDate
            }
          });
          logger.info('Sent subscription status change event to admins', { shopAddress, action: 'self_cancelled' });
        }
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

      // Send real-time notification via WebSocket to the shop
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);

        // Also notify admins so their dashboard can refresh
        const adminAddresses = this.getAdminAddresses();
        if (adminAddresses.length > 0) {
          this.wsManager.sendToAddresses(adminAddresses, {
            type: 'subscription_status_changed',
            payload: {
              shopAddress,
              action: 'reactivated'
            }
          });
          logger.info('Sent subscription status change event to admins', { shopAddress, action: 'reactivated' });
        }
      }
    } catch (error: any) {
      logger.error('Error handling subscription reactivated event:', error);
    }
  }

  // Shop Suspension Event Handlers

  private async handleShopSuspended(event: any): Promise<void> {
    try {
      const { shopAddress, shopName, reason } = event.data;

      logger.info(`Creating shop suspended notification for ${shopAddress}`);

      const notification = await this.notificationService.createShopSuspendedNotification(
        shopAddress,
        shopName,
        reason
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);

        // Also notify admins so their dashboard can refresh
        const adminAddresses = this.getAdminAddresses();
        if (adminAddresses.length > 0) {
          this.wsManager.sendToAddresses(adminAddresses, {
            type: 'shop_status_changed',
            payload: {
              shopAddress,
              action: 'suspended'
            }
          });
          logger.info('Sent shop status change event to admins', { shopAddress, action: 'suspended' });
        }
      }
    } catch (error: any) {
      logger.error('Error handling shop suspended event:', error);
    }
  }

  private async handleShopUnsuspended(event: any): Promise<void> {
    try {
      const { shopAddress, shopName } = event.data;

      logger.info(`Creating shop unsuspended notification for ${shopAddress}`);

      const notification = await this.notificationService.createShopUnsuspendedNotification(
        shopAddress,
        shopName
      );

      // Send real-time notification via WebSocket
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);

        // Also notify admins so their dashboard can refresh
        const adminAddresses = this.getAdminAddresses();
        if (adminAddresses.length > 0) {
          this.wsManager.sendToAddresses(adminAddresses, {
            type: 'shop_status_changed',
            payload: {
              shopAddress,
              action: 'unsuspended'
            }
          });
          logger.info('Sent shop status change event to admins', { shopAddress, action: 'unsuspended' });
        }
      }
    } catch (error: any) {
      logger.error('Error handling shop unsuspended event:', error);
    }
  }

  // Reschedule Request Event Handlers

  private async handleRescheduleRequestCreated(event: any): Promise<void> {
    try {
      const {
        requestId,
        orderId,
        shopId,
        customerAddress,
        originalDate,
        originalTimeSlot,
        requestedDate,
        requestedTimeSlot
      } = event.data;

      logger.info(`Creating reschedule request notification for shop ${shopId}`, { requestId, orderId });

      // We need to get additional info (customer name, service name, shop address) from the database
      // For now, use placeholders - the event data could be enriched in RescheduleService
      const customerName = event.data.customerName || 'Customer';
      const serviceName = event.data.serviceName || 'Service';
      const shopAddress = event.data.shopAddress || shopId;

      const notification = await this.notificationService.createRescheduleRequestCreatedNotification(
        customerAddress,
        shopAddress,
        customerName,
        serviceName,
        orderId,
        requestId,
        originalDate,
        originalTimeSlot,
        requestedDate,
        requestedTimeSlot
      );

      // Send real-time notification via WebSocket to the shop
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(shopAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling reschedule request created event:', error);
    }
  }

  private async handleRescheduleRequestApproved(event: any): Promise<void> {
    try {
      const {
        requestId,
        orderId,
        shopId,
        customerAddress,
        newDate,
        newTimeSlot
      } = event.data;

      logger.info(`Creating reschedule approved notification for customer ${customerAddress}`, { requestId, orderId });

      const shopName = event.data.shopName || 'Shop';
      const serviceName = event.data.serviceName || 'Service';
      const shopAddress = event.data.shopAddress || shopId;

      const notification = await this.notificationService.createRescheduleRequestApprovedNotification(
        shopAddress,
        customerAddress,
        shopName,
        serviceName,
        orderId,
        requestId,
        newDate,
        newTimeSlot
      );

      // Send real-time notification via WebSocket to the customer
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(customerAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling reschedule request approved event:', error);
    }
  }

  private async handleRescheduleRequestRejected(event: any): Promise<void> {
    try {
      const {
        requestId,
        orderId,
        shopId,
        customerAddress,
        reason
      } = event.data;

      logger.info(`Creating reschedule rejected notification for customer ${customerAddress}`, { requestId, orderId });

      const shopName = event.data.shopName || 'Shop';
      const serviceName = event.data.serviceName || 'Service';
      const shopAddress = event.data.shopAddress || shopId;

      const notification = await this.notificationService.createRescheduleRequestRejectedNotification(
        shopAddress,
        customerAddress,
        shopName,
        serviceName,
        orderId,
        requestId,
        reason
      );

      // Send real-time notification via WebSocket to the customer
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(customerAddress, notification);
      }
    } catch (error: any) {
      logger.error('Error handling reschedule request rejected event:', error);
    }
  }

  private async handleRescheduleRequestExpired(event: any): Promise<void> {
    try {
      const {
        requestId,
        orderId,
        shopId,
        customerAddress,
        customerName,
        shopName,
        serviceName
      } = event.data;

      logger.info(`Creating reschedule expired notification for customer ${customerAddress}`, { requestId, orderId });

      // 1. Create in-app notification
      const notification = await this.notificationService.createRescheduleRequestExpiredNotification(
        customerAddress,
        shopName || 'Shop',
        serviceName || 'Service',
        orderId,
        requestId
      );

      // 2. Send real-time notification via WebSocket to the customer
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(customerAddress, notification);
      }

      // 3. Send email notification
      try {
        const customer = await this.customerRepository.getCustomer(customerAddress);
        if (customer?.email) {
          await this.emailService.sendRescheduleRequestExpired({
            customerEmail: customer.email,
            customerName: customerName || customer.name || 'Customer',
            shopName: shopName || 'Shop',
            serviceName: serviceName || 'Service',
            orderId
          });
          logger.info('Reschedule expired email sent to customer', { orderId, customerEmail: customer.email });
        } else {
          logger.warn('No customer email for reschedule expired notification', { orderId, customerAddress });
        }
      } catch (emailError) {
        logger.error('Error sending reschedule expired email:', emailError);
        // Don't throw - email is best effort
      }

      logger.info('Reschedule request expired notification sent', { requestId, orderId, customerAddress });
    } catch (error: any) {
      logger.error('Error handling reschedule request expired event:', error);
    }
  }

  // Shop Direct Reschedule Event Handler

  private async handleBookingRescheduledByShop(event: any): Promise<void> {
    try {
      const {
        orderId,
        shopId,
        shopName,
        customerAddress,
        customerName,
        serviceName,
        originalDate,
        originalTimeSlot,
        newDate,
        newTimeSlot,
        reason
      } = event.data;

      logger.info(`Creating booking rescheduled by shop notification for customer ${customerAddress}`, { orderId });

      // Format dates and times for display
      const formatDate = (dateStr: string): string => {
        if (!dateStr) return 'TBD';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      };

      const formatTime = (timeStr: string): string => {
        if (!timeStr) return 'TBD';
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
      };

      // Get shop address for sender
      const shopAddress = event.data.rescheduledBy || shopId;

      const formattedOriginalDate = formatDate(originalDate);
      const formattedOriginalTime = formatTime(originalTimeSlot);
      const formattedNewDate = formatDate(newDate);
      const formattedNewTime = formatTime(newTimeSlot);

      // Create in-app notification
      const notification = await this.notificationService.createBookingRescheduledByShopNotification(
        shopAddress,
        customerAddress,
        shopName || 'Shop',
        serviceName || 'Service',
        orderId,
        formattedOriginalDate,
        formattedOriginalTime,
        formattedNewDate,
        formattedNewTime,
        reason
      );

      // Send real-time notification via WebSocket to the customer
      if (this.wsManager) {
        this.wsManager.sendNotificationToUser(customerAddress, notification);
      }

      // Send push notification using existing reschedule approved method
      await this.expoPushService.sendRescheduleApproved(
        customerAddress,
        shopName || 'Shop',
        serviceName || 'Service',
        formattedNewDate,
        formattedNewTime,
        orderId
      );

      // Send email notification
      try {
        const customer = await this.customerRepository.getCustomer(customerAddress);
        if (customer?.email) {
          await this.emailService.sendAppointmentRescheduledByShop({
            customerEmail: customer.email,
            customerName: customerName || customer.name || 'Customer',
            shopName: shopName || 'Shop',
            serviceName: serviceName || 'Service',
            originalDate: formattedOriginalDate,
            originalTime: formattedOriginalTime,
            newDate: formattedNewDate,
            newTime: formattedNewTime,
            reason
          });
          logger.info('Reschedule email sent to customer', { orderId, customerEmail: customer.email });
        }
      } catch (emailError) {
        logger.error('Error sending reschedule email:', emailError);
        // Don't throw - email is best effort
      }

      logger.info('Booking rescheduled by shop notification sent', { orderId, customerAddress });
    } catch (error: any) {
      logger.error('Error handling booking rescheduled by shop event:', error);
    }
  }
}
