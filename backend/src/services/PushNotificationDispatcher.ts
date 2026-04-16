import { getExpoPushService, ExpoPushService, PushNotificationPayload, SendPushResult, NotificationChannels } from './ExpoPushService';
import { getWebPushService, WebPushService } from './WebPushService';
import { logger } from '../utils/logger';

/**
 * Dispatches push notifications to both mobile (Expo) and web (VAPID) push services.
 * All callers use this instead of ExpoPushService directly.
 */
export class PushNotificationDispatcher {
  private expoPushService: ExpoPushService;
  private webPushService: WebPushService;

  constructor() {
    this.expoPushService = getExpoPushService();
    this.webPushService = getWebPushService();
  }

  /**
   * Merge two SendPushResult objects
   */
  private mergeResults(a: SendPushResult, b: SendPushResult): SendPushResult {
    return {
      successCount: a.successCount + b.successCount,
      failureCount: a.failureCount + b.failureCount,
      invalidTokens: [...a.invalidTokens, ...b.invalidTokens],
    };
  }

  /**
   * Send push notification to a single user across all platforms
   */
  async sendToUser(walletAddress: string, notification: PushNotificationPayload): Promise<SendPushResult> {
    const [expoResult, webResult] = await Promise.all([
      this.expoPushService.sendToUser(walletAddress, notification),
      this.webPushService.sendToUser(walletAddress, notification),
    ]);

    return this.mergeResults(expoResult, webResult);
  }

  /**
   * Send push notification to multiple users across all platforms
   */
  async sendToMultipleUsers(
    walletAddresses: string[],
    notification: PushNotificationPayload
  ): Promise<SendPushResult> {
    const [expoResult, webResult] = await Promise.all([
      this.expoPushService.sendToMultipleUsers(walletAddresses, notification),
      this.webPushService.sendToMultipleUsers(walletAddresses, notification),
    ]);

    return this.mergeResults(expoResult, webResult);
  }

  // ============================================
  // Convenience methods (delegate to sendToUser)
  // ============================================

  async sendRewardNotification(
    customerAddress: string,
    shopName: string,
    amount: number,
    transactionId?: string
  ): Promise<SendPushResult> {
    return this.sendToUser(customerAddress, {
      title: 'Reward Received!',
      body: `You received ${amount} RCN from ${shopName}`,
      channelId: NotificationChannels.REWARDS,
      data: { type: 'reward_issued', transactionId, amount, shopName },
    });
  }

  async sendRedemptionApprovalRequest(
    customerAddress: string,
    shopName: string,
    amount: number,
    sessionId: string
  ): Promise<SendPushResult> {
    return this.sendToUser(customerAddress, {
      title: 'Redemption Request',
      body: `${shopName} wants to redeem ${amount} RCN from your balance`,
      channelId: NotificationChannels.REDEMPTIONS,
      priority: 'high',
      data: { type: 'redemption_approval_requested', sessionId, amount, shopName },
    });
  }

  async sendBookingConfirmation(
    customerAddress: string,
    shopName: string,
    serviceName: string,
    appointmentDate: string,
    appointmentTime: string,
    orderId: string
  ): Promise<SendPushResult> {
    return this.sendToUser(customerAddress, {
      title: 'Booking Confirmed',
      body: `Your ${serviceName} at ${shopName} is confirmed for ${appointmentDate} at ${appointmentTime}`,
      channelId: NotificationChannels.APPOINTMENTS,
      data: { type: 'booking_confirmed', orderId, shopName, serviceName, appointmentDate, appointmentTime },
    });
  }

  async sendAppointmentReminder(
    customerAddress: string,
    shopName: string,
    serviceName: string,
    appointmentTime: string,
    orderId: string
  ): Promise<SendPushResult> {
    return this.sendToUser(customerAddress, {
      title: 'Appointment Tomorrow',
      body: `Reminder: ${serviceName} at ${shopName} at ${appointmentTime}`,
      channelId: NotificationChannels.APPOINTMENTS,
      priority: 'high',
      data: { type: 'appointment_reminder', orderId, shopName, serviceName, appointmentTime },
    });
  }

  async sendOrderCompleted(
    customerAddress: string,
    shopName: string,
    serviceName: string,
    rcnEarned: number,
    orderId: string
  ): Promise<SendPushResult> {
    return this.sendToUser(customerAddress, {
      title: 'Service Complete',
      body: `${shopName} completed your ${serviceName}. You earned ${rcnEarned} RCN!`,
      channelId: NotificationChannels.REWARDS,
      data: { type: 'order_completed', orderId, shopName, serviceName, rcnEarned },
    });
  }

  async sendNewBookingToShop(
    shopAddress: string,
    customerName: string,
    serviceName: string,
    appointmentDate: string,
    appointmentTime: string,
    orderId: string
  ): Promise<SendPushResult> {
    return this.sendToUser(shopAddress, {
      title: 'New Booking',
      body: `${customerName} booked ${serviceName} for ${appointmentDate} at ${appointmentTime}`,
      channelId: NotificationChannels.APPOINTMENTS,
      data: { type: 'new_booking', orderId, customerName, serviceName, appointmentDate, appointmentTime },
    });
  }

  async sendTokenGiftedNotification(
    toCustomerAddress: string,
    fromCustomerName: string,
    amount: number,
    transactionId: string
  ): Promise<SendPushResult> {
    return this.sendToUser(toCustomerAddress, {
      title: 'Gift Received!',
      body: `${fromCustomerName} gifted you ${amount} RCN`,
      channelId: NotificationChannels.REWARDS,
      data: { type: 'token_gifted', transactionId, amount, fromCustomerName },
    });
  }

  async sendRescheduleRequestToShop(
    shopAddress: string,
    customerName: string,
    serviceName: string,
    originalDate: string,
    originalTime: string,
    requestedDate: string,
    requestedTime: string,
    requestId: string
  ): Promise<SendPushResult> {
    return this.sendToUser(shopAddress, {
      title: 'Reschedule Request',
      body: `${customerName} wants to reschedule ${serviceName} from ${originalDate} to ${requestedDate}`,
      channelId: NotificationChannels.APPOINTMENTS,
      data: {
        type: 'reschedule_request',
        requestId,
        customerName,
        serviceName,
        originalDate,
        originalTime,
        requestedDate,
        requestedTime,
      },
    });
  }

  async sendRescheduleApproved(
    customerAddress: string,
    shopName: string,
    serviceName: string,
    newDate: string,
    newTime: string,
    requestId: string
  ): Promise<SendPushResult> {
    return this.sendToUser(customerAddress, {
      title: 'Reschedule Approved',
      body: `${shopName} approved your reschedule for ${serviceName}. New time: ${newDate} at ${newTime}`,
      channelId: NotificationChannels.APPOINTMENTS,
      data: { type: 'reschedule_approved', requestId, shopName, serviceName, newDate, newTime },
    });
  }

  async sendRescheduleRejected(
    customerAddress: string,
    shopName: string,
    serviceName: string,
    reason: string | undefined,
    requestId: string
  ): Promise<SendPushResult> {
    const reasonText = reason ? `: ${reason}` : '';
    return this.sendToUser(customerAddress, {
      title: 'Reschedule Declined',
      body: `${shopName} declined your reschedule request for ${serviceName}${reasonText}`,
      channelId: NotificationChannels.APPOINTMENTS,
      data: { type: 'reschedule_rejected', requestId, shopName, serviceName, reason },
    });
  }

  async sendSubscriptionExpiringNotification(
    shopAddress: string,
    shopName: string,
    daysRemaining: number,
    expirationDate: string
  ): Promise<SendPushResult> {
    const urgency = daysRemaining <= 1 ? 'tomorrow' : `in ${daysRemaining} days`;
    const title = daysRemaining <= 1 ? 'Subscription Expires Tomorrow!' : 'Subscription Expiring Soon';

    return this.sendToUser(shopAddress, {
      title,
      body: `Your RepairCoin subscription expires ${urgency}. Renew now to keep earning rewards.`,
      channelId: NotificationChannels.DEFAULT,
      priority: daysRemaining <= 1 ? 'high' : 'default',
      data: { type: 'subscription_expiring', shopName, daysRemaining, expirationDate },
    });
  }
}

// Singleton instance
let dispatcherInstance: PushNotificationDispatcher | null = null;

export function getPushNotificationDispatcher(): PushNotificationDispatcher {
  if (!dispatcherInstance) {
    dispatcherInstance = new PushNotificationDispatcher();
  }
  return dispatcherInstance;
}
