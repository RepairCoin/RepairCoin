// backend/src/services/SubscriptionReminderService.ts
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { NotificationService } from '../domains/notification/services/NotificationService';
import { getExpoPushService, ExpoPushService } from './ExpoPushService';
import { getSharedPool } from '../utils/database-pool';

export interface SubscriptionReminderData {
  shopId: string;
  shopName: string;
  shopEmail?: string;
  walletAddress: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: Date;
  daysRemaining: number;
}

export interface ReminderReport {
  timestamp: Date;
  subscriptionsChecked: number;
  reminder7dSent: number;
  reminder3dSent: number;
  reminder1dSent: number;
  emailsSent: number;
  pushNotificationsSent: number;
  errors: string[];
}

// Reminder type configuration
type ReminderType = '7d' | '3d' | '1d';

interface ReminderConfig {
  type: ReminderType;
  daysBeforeMin: number;
  daysBeforeMax: number;
  sendEmail: boolean;
  sendPush: boolean;
  sendInApp: boolean;
  flagColumn: string;
  timestampColumn: string;
}

const REMINDER_CONFIGS: ReminderConfig[] = [
  {
    type: '7d',
    daysBeforeMin: 6,
    daysBeforeMax: 8,
    sendEmail: true,
    sendPush: true,
    sendInApp: true,
    flagColumn: 'reminder_7d_sent',
    timestampColumn: 'reminder_7d_sent_at'
  },
  {
    type: '3d',
    daysBeforeMin: 2,
    daysBeforeMax: 4,
    sendEmail: true,
    sendPush: true,
    sendInApp: true,
    flagColumn: 'reminder_3d_sent',
    timestampColumn: 'reminder_3d_sent_at'
  },
  {
    type: '1d',
    daysBeforeMin: 0,
    daysBeforeMax: 2,
    sendEmail: true,
    sendPush: true,
    sendInApp: true,
    flagColumn: 'reminder_1d_sent',
    timestampColumn: 'reminder_1d_sent_at'
  }
];

export class SubscriptionReminderService {
  private emailService: EmailService;
  private notificationService: NotificationService;
  private expoPushService: ExpoPushService;
  private scheduledIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.emailService = new EmailService();
    this.notificationService = new NotificationService();
    this.expoPushService = getExpoPushService();
  }

  /**
   * Get subscriptions that need a specific type of reminder
   */
  async getSubscriptionsForReminderType(config: ReminderConfig): Promise<SubscriptionReminderData[]> {
    try {
      const query = `
        SELECT
          s.shop_id as "shopId",
          s.name as "shopName",
          s.email as "shopEmail",
          s.wallet_address as "walletAddress",
          ss.stripe_subscription_id as "stripeSubscriptionId",
          ss.current_period_end as "currentPeriodEnd",
          EXTRACT(DAY FROM ss.current_period_end - NOW())::int as "daysRemaining"
        FROM stripe_subscriptions ss
        JOIN shops s ON s.shop_id = ss.shop_id
        WHERE ss.status = 'active'
          AND ss.cancel_at_period_end = false
          AND COALESCE(ss.${config.flagColumn}, false) IS NOT TRUE
          AND ss.current_period_end > NOW()
          AND ss.current_period_end <= NOW() + INTERVAL '${config.daysBeforeMax} days'
          AND ss.current_period_end > NOW() + INTERVAL '${config.daysBeforeMin} days'
        ORDER BY ss.current_period_end ASC
      `;

      const result = await getSharedPool().query(query);
      return result.rows;
    } catch (error) {
      logger.error(`Error getting subscriptions for ${config.type} reminder:`, error);
      throw error;
    }
  }

  /**
   * Send subscription expiring email to shop
   */
  async sendReminderEmail(data: SubscriptionReminderData): Promise<boolean> {
    if (!data.shopEmail) {
      logger.warn('No shop email for subscription reminder', { shopId: data.shopId });
      return false;
    }

    const urgency = data.daysRemaining <= 1 ? 'tomorrow' : `in ${data.daysRemaining} days`;
    const subject = data.daysRemaining <= 1
      ? `Action Required: Your RepairCoin subscription expires tomorrow!`
      : `Reminder: Your RepairCoin subscription expires ${urgency}`;

    const expirationDate = new Date(data.currentPeriodEnd);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${data.daysRemaining <= 1 ? '#dc3545' : '#FFCC00'}; padding: 20px; text-align: center;">
          <h1 style="color: ${data.daysRemaining <= 1 ? '#fff' : '#000'}; margin: 0;">
            ${data.daysRemaining <= 1 ? 'Subscription Expires Tomorrow!' : 'Subscription Expiring Soon'}
          </h1>
        </div>

        <div style="padding: 20px;">
          <p>Hi ${data.shopName},</p>

          <p>Your RepairCoin subscription expires <strong>${urgency}</strong> on ${expirationDate.toLocaleDateString()}.</p>

          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${data.daysRemaining <= 1 ? '#dc3545' : '#FFCC00'};">
            <p style="margin: 5px 0;"><strong>Shop:</strong> ${data.shopName}</p>
            <p style="margin: 5px 0;"><strong>Expiration Date:</strong> ${expirationDate.toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Days Remaining:</strong> ${data.daysRemaining} day${data.daysRemaining !== 1 ? 's' : ''}</p>
          </div>

          ${data.daysRemaining <= 1 ? `
          <div style="background-color: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #f5c6cb;">
            <p style="margin: 0; color: #721c24;">
              <strong>Important:</strong> If your subscription expires, you will lose access to:
            </p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #721c24;">
              <li>Issuing RCN rewards to customers</li>
              <li>Processing redemptions</li>
              <li>Service bookings</li>
              <li>Customer management features</li>
            </ul>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <p>Renew now to ensure uninterrupted service for your customers.</p>
          </div>

          <p>Thank you for being a valued RepairCoin partner!</p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p style="margin: 5px 0;">This is an automated reminder from RepairCoin.</p>
          <p style="margin: 5px 0;">Questions? Contact support@repaircoin.com</p>
        </div>
      </div>
    `;

    return await this.emailService['sendEmail'](data.shopEmail, subject, html);
  }

  /**
   * Send in-app notification for subscription expiring
   */
  async sendInAppNotification(data: SubscriptionReminderData): Promise<void> {
    try {
      const urgency = data.daysRemaining <= 1 ? 'tomorrow' : `in ${data.daysRemaining} days`;
      const message = `Your RepairCoin subscription expires ${urgency}. Renew now to keep earning rewards.`;

      await this.notificationService.createNotification({
        senderAddress: 'SYSTEM',
        receiverAddress: data.walletAddress,
        notificationType: 'subscription_expiring',
        message,
        metadata: {
          shopId: data.shopId,
          shopName: data.shopName,
          daysRemaining: data.daysRemaining,
          expirationDate: data.currentPeriodEnd.toISOString(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error sending subscription expiring in-app notification:', error);
      throw error;
    }
  }

  /**
   * Send push notification for subscription expiring
   */
  async sendPushNotification(data: SubscriptionReminderData): Promise<boolean> {
    try {
      const result = await this.expoPushService.sendSubscriptionExpiringNotification(
        data.walletAddress,
        data.shopName,
        data.daysRemaining,
        data.currentPeriodEnd.toISOString()
      );
      return result.successCount > 0;
    } catch (error) {
      logger.error('Error sending subscription expiring push notification:', error);
      return false;
    }
  }

  /**
   * Mark reminder as sent for a subscription
   */
  async markReminderSent(subscriptionId: string, config: ReminderConfig): Promise<void> {
    try {
      await getSharedPool().query(
        `UPDATE stripe_subscriptions
         SET ${config.flagColumn} = true,
             ${config.timestampColumn} = NOW(),
             updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [subscriptionId]
      );
    } catch (error) {
      logger.error('Error marking subscription reminder as sent:', error);
      throw error;
    }
  }

  /**
   * Process reminders for a specific reminder type
   */
  async processRemindersForType(config: ReminderConfig, report: ReminderReport): Promise<void> {
    const subscriptions = await this.getSubscriptionsForReminderType(config);

    logger.info(`Found ${subscriptions.length} subscriptions needing ${config.type} reminder`);

    for (const sub of subscriptions) {
      try {
        let reminderSent = false;

        // Send push notification
        if (config.sendPush) {
          const pushSent = await this.sendPushNotification(sub);
          if (pushSent) {
            report.pushNotificationsSent++;
            reminderSent = true;
          }
        }

        // Send in-app notification
        if (config.sendInApp) {
          await this.sendInAppNotification(sub);
          reminderSent = true;
        }

        // Send email
        if (config.sendEmail) {
          const emailSent = await this.sendReminderEmail(sub);
          if (emailSent) {
            report.emailsSent++;
            reminderSent = true;
          }
        }

        // Mark reminder as sent if any notification was sent
        if (reminderSent) {
          await this.markReminderSent(sub.stripeSubscriptionId, config);

          // Update report counts
          if (config.type === '7d') report.reminder7dSent++;
          else if (config.type === '3d') report.reminder3dSent++;
          else if (config.type === '1d') report.reminder1dSent++;

          logger.info(`Sent ${config.type} subscription reminder`, {
            shopId: sub.shopId,
            shopName: sub.shopName,
            daysRemaining: sub.daysRemaining
          });
        }
      } catch (error: any) {
        report.errors.push(`Failed to send ${config.type} reminder for ${sub.shopId}: ${error.message}`);
        logger.error(`Error processing ${config.type} reminder for shop:`, { shopId: sub.shopId, error });
      }
    }
  }

  /**
   * Process all subscription reminders
   */
  async processAllReminders(): Promise<ReminderReport> {
    if (this.isRunning) {
      logger.warn('Subscription reminder check already in progress, skipping');
      return {
        timestamp: new Date(),
        subscriptionsChecked: 0,
        reminder7dSent: 0,
        reminder3dSent: 0,
        reminder1dSent: 0,
        emailsSent: 0,
        pushNotificationsSent: 0,
        errors: ['Check already in progress']
      };
    }

    this.isRunning = true;
    const report: ReminderReport = {
      timestamp: new Date(),
      subscriptionsChecked: 0,
      reminder7dSent: 0,
      reminder3dSent: 0,
      reminder1dSent: 0,
      emailsSent: 0,
      pushNotificationsSent: 0,
      errors: []
    };

    try {
      logger.info('Starting subscription reminder check...');

      // Process each reminder type
      for (const config of REMINDER_CONFIGS) {
        await this.processRemindersForType(config, report);
      }

      const totalSent = report.reminder7dSent + report.reminder3dSent + report.reminder1dSent;
      logger.info('Subscription reminder check complete', {
        reminder7dSent: report.reminder7dSent,
        reminder3dSent: report.reminder3dSent,
        reminder1dSent: report.reminder1dSent,
        totalSent,
        emailsSent: report.emailsSent,
        pushNotificationsSent: report.pushNotificationsSent,
        errors: report.errors.length
      });

      return report;
    } catch (error: any) {
      report.errors.push(`Fatal error: ${error.message}`);
      logger.error('Fatal error during subscription reminder check:', error);
      return report;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the scheduled reminder service
   * Runs every 6 hours by default
   */
  startScheduler(intervalHours: number = 6): void {
    if (this.scheduledIntervalId) {
      logger.warn('Subscription reminder scheduler already running');
      return;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;

    logger.info(`Starting subscription reminder scheduler (every ${intervalHours} hours)`);

    // Run immediately on start
    this.processAllReminders().catch(error => {
      logger.error('Error in initial subscription reminder check:', error);
    });

    // Schedule regular checks
    this.scheduledIntervalId = setInterval(() => {
      this.processAllReminders().catch(error => {
        logger.error('Error in scheduled subscription reminder check:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop the scheduled reminder service
   */
  stopScheduler(): void {
    if (this.scheduledIntervalId) {
      clearInterval(this.scheduledIntervalId);
      this.scheduledIntervalId = null;
      logger.info('Subscription reminder scheduler stopped');
    }
  }

  /**
   * Reset reminder flags for a subscription (e.g., when subscription is renewed)
   */
  async resetReminderFlags(subscriptionId: string): Promise<void> {
    try {
      await getSharedPool().query(
        `UPDATE stripe_subscriptions
         SET reminder_7d_sent = false,
             reminder_7d_sent_at = NULL,
             reminder_3d_sent = false,
             reminder_3d_sent_at = NULL,
             reminder_1d_sent = false,
             reminder_1d_sent_at = NULL,
             updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [subscriptionId]
      );
      logger.info('Reset reminder flags for subscription', { subscriptionId });
    } catch (error) {
      logger.error('Error resetting reminder flags:', error);
      throw error;
    }
  }
}

// Singleton instance
let subscriptionReminderServiceInstance: SubscriptionReminderService | null = null;

export function getSubscriptionReminderService(): SubscriptionReminderService {
  if (!subscriptionReminderServiceInstance) {
    subscriptionReminderServiceInstance = new SubscriptionReminderService();
  }
  return subscriptionReminderServiceInstance;
}

// Export singleton for direct use
export const subscriptionReminderService = new SubscriptionReminderService();
