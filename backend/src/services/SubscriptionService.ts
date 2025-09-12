import { shopSubscriptionRepository, shopRepository } from '../repositories';
import { EmailService } from './EmailService';
import { logger } from '../utils/logger';
import cron from 'node-cron';

export interface SubscriptionConfig {
  gracePeriodDays: number;
  warningDays: number[];
  trialPeriodDays: number;
  defaultMonthlyAmount: number;
}

export class SubscriptionService {
  private emailService: EmailService;
  private config: SubscriptionConfig;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(config?: Partial<SubscriptionConfig>) {
    this.emailService = new EmailService();
    this.config = {
      gracePeriodDays: 7,
      warningDays: [7, 3, 1], // Send warnings at 7, 3, and 1 days before due
      trialPeriodDays: 14,
      defaultMonthlyAmount: 500,
      ...config
    };
  }

  /**
   * Start automated subscription workflows
   */
  startAutomatedWorkflows() {
    // Check for overdue payments daily at 2 AM
    const overdueJob = cron.schedule('0 2 * * *', async () => {
      await this.processOverdueSubscriptions();
    });
    this.cronJobs.set('overdue', overdueJob);

    // Send payment reminders daily at 10 AM
    const reminderJob = cron.schedule('0 10 * * *', async () => {
      await this.sendPaymentReminders();
    });
    this.cronJobs.set('reminder', reminderJob);

    // Process trial expirations daily at 12 PM
    const trialJob = cron.schedule('0 12 * * *', async () => {
      await this.processTrialExpirations();
    });
    this.cronJobs.set('trial', trialJob);

    logger.info('Subscription automated workflows started');
  }

  /**
   * Stop all automated workflows
   */
  stopAutomatedWorkflows() {
    this.cronJobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    });
    this.cronJobs.clear();
  }

  /**
   * Process overdue subscriptions and handle grace period
   */
  async processOverdueSubscriptions() {
    try {
      logger.info('Processing overdue subscriptions...');
      
      const overdue = await shopSubscriptionRepository.getOverduePayments();
      
      for (const subscription of overdue) {
        const daysOverdue = this.calculateDaysOverdue(subscription.nextPaymentDate);
        
        if (daysOverdue > this.config.gracePeriodDays) {
          // Grace period exceeded - default the subscription
          await this.defaultSubscription(subscription);
        } else {
          // Still in grace period - send warning
          await this.sendOverdueNotice(subscription, daysOverdue);
        }
      }
      
      // Use repository method to bulk default subscriptions
      const defaultedCount = await shopSubscriptionRepository.checkAndDefaultOverdueSubscriptions(
        this.config.gracePeriodDays
      );
      
      logger.info(`Processed overdue subscriptions. Defaulted: ${defaultedCount}`);
    } catch (error) {
      logger.error('Error processing overdue subscriptions:', error);
    }
  }

  /**
   * Send payment reminders before due date
   */
  async sendPaymentReminders() {
    try {
      logger.info('Sending payment reminders...');
      
      const activeSubscriptions = await shopSubscriptionRepository.getActiveSubscriptions();
      let remindersSent = 0;
      
      for (const subscription of activeSubscriptions) {
        if (!subscription.nextPaymentDate) continue;
        
        const daysUntilDue = this.calculateDaysUntilDue(subscription.nextPaymentDate);
        
        // Check if we should send a reminder today
        if (this.config.warningDays.includes(daysUntilDue)) {
          await this.sendPaymentReminder(subscription, daysUntilDue);
          remindersSent++;
        }
      }
      
      logger.info(`Payment reminders sent: ${remindersSent}`);
    } catch (error) {
      logger.error('Error sending payment reminders:', error);
    }
  }

  /**
   * Process trial period expirations
   */
  async processTrialExpirations() {
    try {
      logger.info('Processing trial expirations...');
      
      // This would check for shops on trial and convert them to paid
      // Implementation depends on trial period feature being added
      
    } catch (error) {
      logger.error('Error processing trial expirations:', error);
    }
  }

  /**
   * Default a subscription after grace period
   */
  private async defaultSubscription(subscription: any) {
    try {
      const shop = await shopRepository.getShop(subscription.shopId);
      if (!shop) return;
      
      // Mark subscription as defaulted
      await shopSubscriptionRepository.markAsDefaulted(
        subscription.id,
        Math.ceil(this.calculateDaysOverdue(subscription.nextPaymentDate) / 30)
      );
      
      // Send defaulted notification
      await this.emailService.sendSubscriptionDefaulted({
        shopEmail: shop.email,
        shopName: shop.name,
        amountDue: subscription.monthlyAmount,
        daysPastDue: this.calculateDaysOverdue(subscription.nextPaymentDate)
      });
      
      logger.info(`Subscription defaulted for shop ${subscription.shopId}`);
    } catch (error) {
      logger.error(`Error defaulting subscription ${subscription.id}:`, error);
    }
  }

  /**
   * Send overdue notice
   */
  private async sendOverdueNotice(subscription: any, daysOverdue: number) {
    try {
      const shop = await shopRepository.getShop(subscription.shopId);
      if (!shop) return;
      
      const daysRemaining = this.config.gracePeriodDays - daysOverdue;
      
      await this.emailService.sendPaymentOverdue({
        shopEmail: shop.email,
        shopName: shop.name,
        amountDue: subscription.monthlyAmount,
        daysOverdue,
        gracePeriodRemaining: daysRemaining,
        suspensionDate: new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
      });
      
    } catch (error) {
      logger.error(`Error sending overdue notice for subscription ${subscription.id}:`, error);
    }
  }

  /**
   * Send payment reminder
   */
  private async sendPaymentReminder(subscription: any, daysUntilDue: number) {
    try {
      const shop = await shopRepository.getShop(subscription.shopId);
      if (!shop) return;
      
      await this.emailService.sendPaymentReminder({
        shopEmail: shop.email,
        shopName: shop.name,
        amountDue: subscription.monthlyAmount,
        dueDate: new Date(subscription.nextPaymentDate),
        daysUntilDue
      });
      
    } catch (error) {
      logger.error(`Error sending payment reminder for subscription ${subscription.id}:`, error);
    }
  }

  /**
   * Reactivate a cancelled subscription
   */
  async reactivateSubscription(shopId: string, paymentMethod?: string) {
    try {
      // Check if shop can subscribe
      const eligibility = await shopSubscriptionRepository.canShopSubscribe(shopId);
      if (!eligibility.canSubscribe) {
        throw new Error(eligibility.reason || 'Shop cannot subscribe');
      }
      
      // Create new subscription
      const subscription = await shopSubscriptionRepository.createSubscription({
        shopId,
        status: 'active',
        monthlyAmount: this.config.defaultMonthlyAmount,
        subscriptionType: 'standard',
        billingMethod: paymentMethod as 'credit_card' | 'ach' | 'wire' | undefined,
        paymentsMade: 0,
        totalPaid: 0,
        nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: 'reactivation'
      });
      
      // Update shop operational status
      await shopRepository.updateShop(shopId, {
        commitment_enrolled: true,
        operational_status: 'commitment_qualified'
      });
      
      // Send reactivation email
      const shop = await shopRepository.getShop(shopId);
      if (shop) {
        await this.emailService.sendSubscriptionReactivated({
          shopEmail: shop.email,
          shopName: shop.name,
          monthlyAmount: this.config.defaultMonthlyAmount,
          nextPaymentDate: subscription.nextPaymentDate!
        });
      }
      
      logger.info(`Subscription reactivated for shop ${shopId}`);
      return subscription;
      
    } catch (error) {
      logger.error(`Error reactivating subscription for shop ${shopId}:`, error);
      throw error;
    }
  }

  /**
   * Create trial subscription for new shops
   */
  async createTrialSubscription(shopId: string) {
    try {
      const trialEndDate = new Date(Date.now() + this.config.trialPeriodDays * 24 * 60 * 60 * 1000);
      
      const subscription = await shopSubscriptionRepository.createSubscription({
        shopId,
        status: 'active',
        monthlyAmount: 0, // Free during trial
        subscriptionType: 'trial',
        paymentsMade: 0,
        totalPaid: 0,
        nextPaymentDate: trialEndDate,
        notes: `${this.config.trialPeriodDays}-day free trial`,
        createdBy: 'system'
      });
      
      // Update shop operational status
      await shopRepository.updateShop(shopId, {
        commitment_enrolled: true,
        operational_status: 'commitment_qualified'
      });
      
      logger.info(`Trial subscription created for shop ${shopId}`);
      return subscription;
      
    } catch (error) {
      logger.error(`Error creating trial subscription for shop ${shopId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate days overdue
   */
  private calculateDaysOverdue(nextPaymentDate?: Date | string): number {
    if (!nextPaymentDate) return 0;
    const dueDate = new Date(nextPaymentDate);
    const now = new Date();
    const diffTime = now.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Calculate days until due
   */
  private calculateDaysUntilDue(nextPaymentDate?: Date | string): number {
    if (!nextPaymentDate) return 999;
    const dueDate = new Date(nextPaymentDate);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}

// Create singleton instance
export const subscriptionService = new SubscriptionService();