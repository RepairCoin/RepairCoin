import Expo, { ExpoPushMessage, ExpoPushTicket, ExpoPushReceiptId } from 'expo-server-sdk';
import { PushTokenRepository, DevicePushToken } from '../repositories/PushTokenRepository';
import { logger } from '../utils/logger';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string; // Android notification channel
  categoryId?: string; // For notification actions
  priority?: 'default' | 'normal' | 'high';
  ttl?: number; // Time to live in seconds
}

export interface SendPushResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

// Predefined notification channels for Android
export const NotificationChannels = {
  DEFAULT: 'default',
  APPOINTMENTS: 'appointments',
  REWARDS: 'rewards',
  REDEMPTIONS: 'redemptions',
} as const;

export class ExpoPushService {
  private expo: Expo;
  private pushTokenRepository: PushTokenRepository;
  private pendingReceipts: Map<string, ExpoPushReceiptId[]> = new Map();

  constructor() {
    this.expo = new Expo();
    this.pushTokenRepository = new PushTokenRepository();
  }

  /**
   * Send push notification to a single user (all their devices)
   */
  async sendToUser(walletAddress: string, notification: PushNotificationPayload): Promise<SendPushResult> {
    const tokens = await this.pushTokenRepository.getActiveTokensByWallet(walletAddress);

    if (tokens.length === 0) {
      logger.debug('No active push tokens for user', { walletAddress });
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    return this.sendToTokens(tokens, notification);
  }

  /**
   * Send push notification to multiple users
   */
  async sendToMultipleUsers(
    walletAddresses: string[],
    notification: PushNotificationPayload
  ): Promise<SendPushResult> {
    const tokenMap = await this.pushTokenRepository.getActiveTokensForUsers(walletAddresses);

    const allTokens: DevicePushToken[] = [];
    tokenMap.forEach((tokens) => allTokens.push(...tokens));

    if (allTokens.length === 0) {
      logger.debug('No active push tokens for any users', { userCount: walletAddresses.length });
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    return this.sendToTokens(allTokens, notification);
  }

  /**
   * Send push notification to specific tokens
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

    // Filter valid Expo push tokens
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t.expoPushToken));
    const invalidTokens = tokens.filter((t) => !Expo.isExpoPushToken(t.expoPushToken));

    // Mark invalid tokens immediately
    for (const invalid of invalidTokens) {
      result.invalidTokens.push(invalid.expoPushToken);
      await this.pushTokenRepository.deactivateToken(invalid.expoPushToken);
      logger.warn('Invalid Expo push token format', { token: invalid.expoPushToken.substring(0, 30) });
    }

    if (validTokens.length === 0) {
      return result;
    }

    // Build messages
    const messages: ExpoPushMessage[] = validTokens.map((token) => this.buildMessage(token, notification));

    // Send in chunks (Expo limit is 100 per request)
    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error: any) {
        logger.error('Error sending push notification chunk', { error: error.message });
        result.failureCount += chunk.length;
      }
    }

    // Process tickets
    const receiptIds: ExpoPushReceiptId[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const token = validTokens[i];

      if (ticket.status === 'ok') {
        result.successCount++;
        if (ticket.id) {
          receiptIds.push(ticket.id);
        }
        // Update last used timestamp
        await this.pushTokenRepository.updateLastUsed(token.expoPushToken);
      } else if (ticket.status === 'error') {
        result.failureCount++;

        // Check if token is invalid
        if (
          ticket.details?.error === 'DeviceNotRegistered' ||
          ticket.details?.error === 'InvalidCredentials'
        ) {
          result.invalidTokens.push(token.expoPushToken);
          await this.pushTokenRepository.deactivateToken(token.expoPushToken);
          logger.info('Push token invalidated', {
            reason: ticket.details?.error,
            token: token.expoPushToken.substring(0, 30),
          });
        } else {
          logger.warn('Push notification failed', {
            error: ticket.message,
            details: ticket.details,
          });
        }
      }
    }

    // Schedule receipt check (Expo recommends checking after 15 minutes)
    if (receiptIds.length > 0) {
      this.scheduleReceiptCheck(receiptIds, validTokens);
    }

    logger.info('Push notifications sent', {
      success: result.successCount,
      failure: result.failureCount,
      invalidated: result.invalidTokens.length,
    });

    return result;
  }

  /**
   * Build Expo push message
   */
  private buildMessage(token: DevicePushToken, notification: PushNotificationPayload): ExpoPushMessage {
    return {
      to: token.expoPushToken,
      sound: notification.sound ?? 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      channelId: notification.channelId || NotificationChannels.DEFAULT,
      categoryId: notification.categoryId,
      priority: notification.priority || 'high',
      ttl: notification.ttl,
      // Badge is iOS only
      ...(token.deviceType === 'ios' && notification.badge !== undefined
        ? { badge: notification.badge }
        : {}),
    };
  }

  /**
   * Schedule receipt check after sending
   * Expo recommends waiting ~15 minutes before checking receipts
   */
  private scheduleReceiptCheck(receiptIds: ExpoPushReceiptId[], tokens: DevicePushToken[]): void {
    // Store receipt IDs for later checking
    const checkId = Date.now().toString();
    this.pendingReceipts.set(checkId, receiptIds);

    // Check receipts after 15 minutes
    setTimeout(async () => {
      await this.checkReceipts(checkId, tokens);
    }, 15 * 60 * 1000);
  }

  /**
   * Check push notification receipts
   */
  private async checkReceipts(checkId: string, tokens: DevicePushToken[]): Promise<void> {
    const receiptIds = this.pendingReceipts.get(checkId);
    if (!receiptIds || receiptIds.length === 0) {
      return;
    }

    this.pendingReceipts.delete(checkId);

    try {
      const receiptChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);

      for (const chunk of receiptChunks) {
        const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);

        for (const [receiptId, receipt] of Object.entries(receipts)) {
          if (receipt.status === 'error') {
            // Find the corresponding token
            const index = receiptIds.indexOf(receiptId);
            if (index !== -1 && tokens[index]) {
              const token = tokens[index];

              if (
                receipt.details?.error === 'DeviceNotRegistered' ||
                receipt.details?.error === 'InvalidCredentials'
              ) {
                await this.pushTokenRepository.deactivateToken(token.expoPushToken);
                logger.info('Push token invalidated from receipt', {
                  reason: receipt.details?.error,
                  token: token.expoPushToken.substring(0, 30),
                });
              } else {
                logger.warn('Push receipt error', {
                  error: receipt.message,
                  details: receipt.details,
                });
              }
            }
          }
        }
      }
    } catch (error: any) {
      logger.error('Error checking push receipts', { error: error.message });
    }
  }

  // ============================================
  // Convenience methods for common notifications
  // ============================================

  /**
   * Send reward issued notification
   */
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
      data: {
        type: 'reward_issued',
        transactionId,
        amount,
        shopName,
      },
    });
  }

  /**
   * Send redemption approval request notification
   */
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
      data: {
        type: 'redemption_approval_requested',
        sessionId,
        amount,
        shopName,
      },
    });
  }

  /**
   * Send booking confirmation notification
   */
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
      data: {
        type: 'booking_confirmed',
        orderId,
        shopName,
        serviceName,
        appointmentDate,
        appointmentTime,
      },
    });
  }

  /**
   * Send appointment reminder notification
   */
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
      data: {
        type: 'appointment_reminder',
        orderId,
        shopName,
        serviceName,
        appointmentTime,
      },
    });
  }

  /**
   * Send order completed notification
   */
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
      data: {
        type: 'order_completed',
        orderId,
        shopName,
        serviceName,
        rcnEarned,
      },
    });
  }

  /**
   * Send notification to shop about new booking
   */
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
      data: {
        type: 'new_booking',
        orderId,
        customerName,
        serviceName,
        appointmentDate,
        appointmentTime,
      },
    });
  }

  /**
   * Send token gifted notification
   */
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
      data: {
        type: 'token_gifted',
        transactionId,
        amount,
        fromCustomerName,
      },
    });
  }
}

// Singleton instance
let expoPushServiceInstance: ExpoPushService | null = null;

export function getExpoPushService(): ExpoPushService {
  if (!expoPushServiceInstance) {
    expoPushServiceInstance = new ExpoPushService();
  }
  return expoPushServiceInstance;
}
