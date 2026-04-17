import webpush from 'web-push';
import { PushTokenRepository, DevicePushToken, WebPushSubscription } from '../repositories/PushTokenRepository';
import { PushNotificationPayload, SendPushResult, NotificationChannels } from './ExpoPushService';
import { Config } from '../config';
import { logger } from '../utils/logger';

const MAX_PAYLOAD_BYTES = 4000; // Web Push spec limit is 4KB, leave some headroom

export class WebPushService {
  private pushTokenRepository: PushTokenRepository;
  private disabled: boolean;

  constructor() {
    this.pushTokenRepository = new PushTokenRepository();
    this.disabled = false;

    const { vapidPublicKey, vapidPrivateKey, vapidSubject } = Config.webPush;

    if (!vapidPublicKey || !vapidPrivateKey) {
      logger.warn('[WebPush] VAPID keys not configured — web push notifications disabled');
      this.disabled = true;
      return;
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    logger.info('[WebPush] Initialized with VAPID keys');
  }

  /**
   * Send web push notification to a single user (all their web browsers)
   */
  async sendToUser(walletAddress: string, notification: PushNotificationPayload): Promise<SendPushResult> {
    if (this.disabled) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const tokens = await this.pushTokenRepository.getActiveTokensByWallet(walletAddress, ['web']);

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    return this.sendToTokens(tokens, notification);
  }

  /**
   * Send web push notification to multiple users
   */
  async sendToMultipleUsers(
    walletAddresses: string[],
    notification: PushNotificationPayload
  ): Promise<SendPushResult> {
    if (this.disabled) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const tokenMap = await this.pushTokenRepository.getActiveTokensForUsers(walletAddresses, ['web']);

    const allTokens: DevicePushToken[] = [];
    tokenMap.forEach((tokens) => allTokens.push(...tokens));

    if (allTokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    return this.sendToTokens(allTokens, notification);
  }

  /**
   * Send web push notifications to specific tokens
   */
  private async sendToTokens(
    tokens: DevicePushToken[],
    notification: PushNotificationPayload
  ): Promise<SendPushResult> {
    const result: SendPushResult = {
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
    };

    const payload = this.buildPayload(notification);

    for (const token of tokens) {
      if (!token.webPushSubscription) {
        result.failureCount++;
        if (token.expoPushToken) {
          result.invalidTokens.push(token.expoPushToken);
          await this.pushTokenRepository.deactivateToken(token.expoPushToken);
        }
        continue;
      }

      try {
        await webpush.sendNotification(token.webPushSubscription as webpush.PushSubscription, payload, {
          TTL: notification.ttl || 86400, // default 24 hours
          urgency: notification.priority === 'high' ? 'high' : 'normal',
        });

        result.successCount++;
        if (token.expoPushToken) {
          await this.pushTokenRepository.updateLastUsed(token.expoPushToken);
        }
      } catch (error: any) {
        result.failureCount++;

        // 410 Gone or 404 Not Found = subscription expired
        if (error.statusCode === 410 || error.statusCode === 404) {
          if (token.expoPushToken) {
            result.invalidTokens.push(token.expoPushToken);
            await this.pushTokenRepository.deactivateToken(token.expoPushToken);
          }
          logger.info('[WebPush] Subscription expired, deactivated', {
            statusCode: error.statusCode,
            endpoint: token.webPushSubscription.endpoint.substring(0, 50),
          });
        } else {
          logger.warn('[WebPush] Failed to send notification', {
            statusCode: error.statusCode,
            message: error.message,
          });
        }
      }
    }

    if (result.successCount > 0 || result.failureCount > 0) {
      logger.info('[WebPush] Notifications sent', {
        success: result.successCount,
        failure: result.failureCount,
        invalidated: result.invalidTokens.length,
      });
    }

    return result;
  }

  /**
   * Build JSON payload for web push, enforcing 4KB limit
   */
  private buildPayload(notification: PushNotificationPayload): string {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      channelId: notification.channelId || NotificationChannels.DEFAULT,
    });

    if (Buffer.byteLength(payload) > MAX_PAYLOAD_BYTES) {
      // Truncate data to fit within limit
      const minimal = JSON.stringify({
        title: notification.title,
        body: notification.body.substring(0, 200),
        data: { type: notification.data?.type },
        channelId: notification.channelId || NotificationChannels.DEFAULT,
      });
      logger.warn('[WebPush] Payload truncated to fit 4KB limit');
      return minimal;
    }

    return payload;
  }

  // ============================================
  // Convenience methods (mirror ExpoPushService)
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
let webPushServiceInstance: WebPushService | null = null;

export function getWebPushService(): WebPushService {
  if (!webPushServiceInstance) {
    webPushServiceInstance = new WebPushService();
  }
  return webPushServiceInstance;
}
