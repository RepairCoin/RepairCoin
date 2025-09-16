import { Pool } from 'pg';
import { getStripeService, StripeService } from './StripeService';
import { logger } from '../utils/logger';
import { BaseRepository } from '../repositories/BaseRepository';
import { eventBus } from '../events/EventBus';
import * as cron from 'node-cron';

export interface PaymentAttemptData {
  id: number;
  shopId: string;
  stripeSubscriptionId: string;
  stripeInvoiceId?: string;
  stripePaymentIntentId?: string;
  attemptNumber: number;
  status: 'succeeded' | 'failed' | 'requires_action' | 'processing';
  failureCode?: string;
  failureMessage?: string;
  amountCents: number;
  currency: string;
  attemptedAt: Date;
  nextRetryAt?: Date;
  metadata: Record<string, any>;
}

export class PaymentRetryService extends BaseRepository {
  private stripeService: StripeService;
  private retryJob: cron.ScheduledTask | null = null;

  constructor() {
    super();
    this.stripeService = getStripeService();
    this.startRetryScheduler();
  }

  /**
   * Start the payment retry scheduler (runs every hour)
   */
  private startRetryScheduler() {
    // Run every hour to check for retries
    this.retryJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.processScheduledRetries();
      } catch (error) {
        logger.error('Error in payment retry scheduler', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    logger.info('Payment retry scheduler started');
  }

  /**
   * Stop the retry scheduler
   */
  stopRetryScheduler() {
    if (this.retryJob) {
      this.retryJob.stop();
      this.retryJob = null;
      logger.info('Payment retry scheduler stopped');
    }
  }

  /**
   * Record a payment attempt
   */
  async recordPaymentAttempt(data: {
    shopId: string;
    stripeSubscriptionId: string;
    stripeInvoiceId?: string;
    stripePaymentIntentId?: string;
    attemptNumber: number;
    status: string;
    failureCode?: string;
    failureMessage?: string;
    amountCents: number;
    currency?: string;
    nextRetryAt?: Date;
    metadata?: Record<string, any>;
  }): Promise<PaymentAttemptData> {
    const query = `
      INSERT INTO stripe_payment_attempts (
        shop_id, stripe_subscription_id, stripe_invoice_id, stripe_payment_intent_id,
        attempt_number, status, failure_code, failure_message, amount_cents, currency,
        next_retry_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      data.shopId,
      data.stripeSubscriptionId,
      data.stripeInvoiceId || null,
      data.stripePaymentIntentId || null,
      data.attemptNumber,
      data.status,
      data.failureCode || null,
      data.failureMessage || null,
      data.amountCents,
      data.currency || 'USD',
      data.nextRetryAt || null,
      JSON.stringify(data.metadata || {})
    ];

    const result = await this.pool.query(query, values);
    return this.mapPaymentAttemptRow(result.rows[0]);
  }

  /**
   * Get payment attempts for a subscription
   */
  async getPaymentAttempts(subscriptionId: string): Promise<PaymentAttemptData[]> {
    const query = `
      SELECT * FROM stripe_payment_attempts 
      WHERE stripe_subscription_id = $1 
      ORDER BY attempted_at DESC
    `;
    const result = await this.pool.query(query, [subscriptionId]);
    return result.rows.map(row => this.mapPaymentAttemptRow(row));
  }

  /**
   * Get failed payment attempts ready for retry
   */
  async getRetryablePayments(): Promise<PaymentAttemptData[]> {
    const query = `
      SELECT * FROM stripe_payment_attempts 
      WHERE status = 'failed' 
        AND next_retry_at IS NOT NULL 
        AND next_retry_at <= NOW() 
        AND attempt_number < 3
      ORDER BY next_retry_at ASC
    `;
    const result = await this.pool.query(query);
    return result.rows.map(row => this.mapPaymentAttemptRow(row));
  }

  /**
   * Process all scheduled payment retries
   */
  async processScheduledRetries(): Promise<void> {
    const retryablePayments = await this.getRetryablePayments();
    
    if (retryablePayments.length === 0) {
      logger.debug('No payment retries scheduled');
      return;
    }

    logger.info(`Processing ${retryablePayments.length} scheduled payment retries`);

    for (const attempt of retryablePayments) {
      await this.retryPayment(attempt);
    }
  }

  /**
   * Retry a specific payment
   */
  async retryPayment(attempt: PaymentAttemptData): Promise<void> {
    const maxRetries = 3;
    
    if (attempt.attemptNumber >= maxRetries) {
      logger.warn('Maximum retries reached for payment', {
        paymentAttemptId: attempt.id,
        shopId: attempt.shopId,
        attemptNumber: attempt.attemptNumber
      });
      
      // Send final failure notification
      await this.sendFinalFailureNotification(attempt);
      return;
    }

    try {
      logger.info('Retrying payment', {
        paymentAttemptId: attempt.id,
        shopId: attempt.shopId,
        attemptNumber: attempt.attemptNumber + 1,
        invoiceId: attempt.stripeInvoiceId
      });

      // Attempt to pay the invoice using Stripe
      if (attempt.stripeInvoiceId) {
        const invoice = await this.stripeService.retryPayment(attempt.stripeInvoiceId);
        
        // Record the new attempt
        await this.recordPaymentAttempt({
          shopId: attempt.shopId,
          stripeSubscriptionId: attempt.stripeSubscriptionId,
          stripeInvoiceId: attempt.stripeInvoiceId,
          stripePaymentIntentId: typeof (invoice as any).payment_intent === 'string' ? (invoice as any).payment_intent : (invoice as any).payment_intent?.id || '',
          attemptNumber: attempt.attemptNumber + 1,
          status: invoice.status === 'paid' ? 'succeeded' : 'failed',
          amountCents: invoice.amount_due,
          currency: invoice.currency?.toUpperCase() || 'USD',
          nextRetryAt: invoice.status === 'paid' ? undefined : this.calculateNextRetryTime(attempt.attemptNumber + 1),
          metadata: {
            retryReason: 'scheduled_retry',
            originalAttemptId: attempt.id
          }
        });

        // Publish event
        eventBus.publish({
          type: invoice.status === 'paid' ? 'payment.retry.succeeded' : 'payment.retry.failed',
          aggregateId: attempt.shopId,
          timestamp: new Date(),
          source: 'PaymentRetryService',
          version: 1,
          data: {
            invoiceId: attempt.stripeInvoiceId,
            attemptNumber: attempt.attemptNumber + 1,
            status: invoice.status,
            paymentAttemptId: attempt.id
          }
        });

        if (invoice.status === 'paid') {
          logger.info('Payment retry succeeded', {
            paymentAttemptId: attempt.id,
            shopId: attempt.shopId,
            invoiceId: attempt.stripeInvoiceId
          });
          
          // Send success notification
          await this.sendRetrySuccessNotification(attempt);
        } else {
          logger.warn('Payment retry failed', {
            paymentAttemptId: attempt.id,
            shopId: attempt.shopId,
            invoiceId: attempt.stripeInvoiceId,
            status: invoice.status
          });
          
          // Send retry failure notification if this was the last attempt
          if (attempt.attemptNumber + 1 >= maxRetries) {
            await this.sendFinalFailureNotification(attempt);
          } else {
            await this.sendRetryFailureNotification(attempt, attempt.attemptNumber + 1);
          }
        }
      }

    } catch (error) {
      logger.error('Error retrying payment', {
        paymentAttemptId: attempt.id,
        shopId: attempt.shopId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Record failed retry attempt
      await this.recordPaymentAttempt({
        shopId: attempt.shopId,
        stripeSubscriptionId: attempt.stripeSubscriptionId,
        stripeInvoiceId: attempt.stripeInvoiceId,
        attemptNumber: attempt.attemptNumber + 1,
        status: 'failed',
        failureMessage: error instanceof Error ? error.message : 'Unknown error',
        amountCents: attempt.amountCents,
        currency: attempt.currency,
        nextRetryAt: this.calculateNextRetryTime(attempt.attemptNumber + 1),
        metadata: {
          retryReason: 'scheduled_retry',
          originalAttemptId: attempt.id,
          retryError: true
        }
      });
    }
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetryTime(attemptNumber: number): Date {
    const maxRetries = 3;
    
    if (attemptNumber >= maxRetries) {
      return new Date(0); // Never retry again
    }
    
    // Exponential backoff: 24h, 48h, 96h
    const baseDelayHours = 24;
    const delayHours = baseDelayHours * Math.pow(2, attemptNumber - 1);
    
    return new Date(Date.now() + delayHours * 60 * 60 * 1000);
  }

  /**
   * Send retry success notification
   */
  private async sendRetrySuccessNotification(attempt: PaymentAttemptData): Promise<void> {
    // Save notification to database
    await this.saveNotification({
      shopId: attempt.shopId,
      type: 'payment_retry_success',
      channel: 'email',
      subject: 'Payment Successful - Subscription Reactivated',
      message: `Your payment of $${(attempt.amountCents / 100).toFixed(2)} has been successfully processed. Your RepairCoin subscription is now active.`,
      metadata: {
        paymentAttemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        invoiceId: attempt.stripeInvoiceId
      }
    });
  }

  /**
   * Send retry failure notification
   */
  private async sendRetryFailureNotification(attempt: PaymentAttemptData, attemptNumber: number): Promise<void> {
    const nextRetry = this.calculateNextRetryTime(attemptNumber);
    const remainingAttempts = 3 - attemptNumber;
    
    await this.saveNotification({
      shopId: attempt.shopId,
      type: 'payment_retry_failed',
      channel: 'email',
      subject: `Payment Failed - ${remainingAttempts} Attempt${remainingAttempts === 1 ? '' : 's'} Remaining`,
      message: `Your payment of $${(attempt.amountCents / 100).toFixed(2)} failed. We'll automatically retry on ${nextRetry.toLocaleDateString()}. Please ensure your payment method is valid.`,
      metadata: {
        paymentAttemptId: attempt.id,
        attemptNumber,
        nextRetryAt: nextRetry.toISOString(),
        remainingAttempts
      }
    });
  }

  /**
   * Send final failure notification
   */
  private async sendFinalFailureNotification(attempt: PaymentAttemptData): Promise<void> {
    await this.saveNotification({
      shopId: attempt.shopId,
      type: 'payment_final_failure',
      channel: 'email',
      subject: 'Subscription Canceled - Payment Failed',
      message: `After 3 attempts, we were unable to process your payment of $${(attempt.amountCents / 100).toFixed(2)}. Your RepairCoin subscription has been canceled. Please update your payment method and resubscribe.`,
      metadata: {
        paymentAttemptId: attempt.id,
        finalAttemptNumber: attempt.attemptNumber,
        invoiceId: attempt.stripeInvoiceId
      }
    });
  }

  /**
   * Save notification to database
   */
  private async saveNotification(data: {
    shopId: string;
    type: string;
    channel: string;
    subject: string;
    message: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    // Get shop email for notification
    const shop = await this.pool.query('SELECT email FROM shops WHERE shop_id = $1', [data.shopId]);
    const email = shop.rows[0]?.email;
    
    if (!email) {
      logger.warn('No email found for shop notification', { shopId: data.shopId });
      return;
    }

    const query = `
      INSERT INTO subscription_notifications (
        shop_id, type, channel, recipient, subject, message, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      data.shopId,
      data.type,
      data.channel,
      email,
      data.subject,
      data.message,
      JSON.stringify(data.metadata || {})
    ];

    await this.pool.query(query, values);
    
    logger.info('Notification saved', {
      shopId: data.shopId,
      type: data.type,
      recipient: email
    });
  }

  /**
   * Map database row to PaymentAttemptData
   */
  private mapPaymentAttemptRow(row: any): PaymentAttemptData {
    return {
      id: row.id,
      shopId: row.shop_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripeInvoiceId: row.stripe_invoice_id,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      attemptNumber: row.attempt_number,
      status: row.status,
      failureCode: row.failure_code,
      failureMessage: row.failure_message,
      amountCents: row.amount_cents,
      currency: row.currency,
      attemptedAt: row.attempted_at,
      nextRetryAt: row.next_retry_at,
      metadata: row.metadata || {}
    };
  }
}

// Singleton instance
let paymentRetryService: PaymentRetryService | null = null;

export function getPaymentRetryService(): PaymentRetryService {
  if (!paymentRetryService) {
    paymentRetryService = new PaymentRetryService();
  }
  return paymentRetryService;
}