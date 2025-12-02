// backend/src/services/SubscriptionEnforcementService.ts
import { BaseRepository } from '../repositories/BaseRepository';
import { getSubscriptionService, SubscriptionData } from './SubscriptionService';
import { getStripeService } from './StripeService';
import { EmailService } from './EmailService';
import { logger } from '../utils/logger';
import { eventBus } from '../events/EventBus';
import cron from 'node-cron';

export interface OverdueSubscription {
  id: number;
  shopId: string;
  shopName: string;
  shopEmail: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: Date;
  daysOverdue: number;
  lastWarningAt?: Date;
  warningCount: number;
}

export interface EnforcementConfig {
  warningDays: number;       // Days overdue before first warning (default: 3)
  gracePeriodDays: number;   // Days overdue before auto-cancel (default: 14)
  maxWarnings: number;       // Max warnings before auto-cancel (default: 3)
  warningIntervalDays: number; // Days between warnings (default: 3)
}

const DEFAULT_CONFIG: EnforcementConfig = {
  warningDays: 3,
  gracePeriodDays: 14,
  maxWarnings: 3,
  warningIntervalDays: 3
};

export class SubscriptionEnforcementService extends BaseRepository {
  private emailService: EmailService;
  private config: EnforcementConfig;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(config?: Partial<EnforcementConfig>) {
    super();
    this.emailService = new EmailService();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the cron job for subscription enforcement
   * Runs daily at 2 AM UTC
   */
  startCronJob(schedule: string = '0 2 * * *'): void {
    if (this.cronJob) {
      logger.warn('Subscription enforcement cron job already running');
      return;
    }

    this.cronJob = cron.schedule(schedule, async () => {
      logger.info('Starting subscription enforcement cron job');
      try {
        await this.enforceAllSubscriptions();
      } catch (error) {
        logger.error('Subscription enforcement cron job failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    logger.info('Subscription enforcement cron job started', { schedule });
  }

  /**
   * Stop the cron job
   */
  stopCronJob(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Subscription enforcement cron job stopped');
    }
  }

  /**
   * Main enforcement function - checks all subscriptions
   */
  async enforceAllSubscriptions(): Promise<{
    checked: number;
    warned: number;
    cancelled: number;
    synced: number;
    errors: number;
  }> {
    const stats = { checked: 0, warned: 0, cancelled: 0, synced: 0, errors: 0 };

    try {
      // Get all overdue subscriptions
      const overdueSubscriptions = await this.getOverdueSubscriptions();
      stats.checked = overdueSubscriptions.length;

      logger.info('Found overdue subscriptions', {
        count: overdueSubscriptions.length
      });

      for (const sub of overdueSubscriptions) {
        try {
          const result = await this.enforceSubscription(sub);
          if (result.action === 'warned') stats.warned++;
          if (result.action === 'cancelled') stats.cancelled++;
          if (result.synced) stats.synced++;
        } catch (error) {
          stats.errors++;
          logger.error('Failed to enforce subscription', {
            shopId: sub.shopId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Subscription enforcement completed', stats);

      // Publish summary event
      eventBus.publish({
        type: 'subscription.enforcement.completed',
        aggregateId: 'system',
        timestamp: new Date(),
        source: 'SubscriptionEnforcementService',
        version: 1,
        data: stats
      });

      return stats;

    } catch (error) {
      logger.error('Failed to run subscription enforcement', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get all overdue subscriptions with shop details
   */
  async getOverdueSubscriptions(): Promise<OverdueSubscription[]> {
    // Use shop_subscriptions.next_payment_date for overdue calculation
    // This is more reliable than stripe_subscriptions.current_period_end which may have stale data
    const query = `
      SELECT
        subs.id,
        subs.shop_id,
        subs.billing_reference as stripe_subscription_id,
        subs.status,
        subs.next_payment_date as current_period_end,
        s.name as shop_name,
        s.email as shop_email,
        COALESCE(sel.last_warning_at, NULL) as last_warning_at,
        COALESCE(sel.warning_count, 0) as warning_count,
        EXTRACT(DAY FROM NOW() - subs.next_payment_date)::int as days_overdue
      FROM shop_subscriptions subs
      JOIN shops s ON subs.shop_id = s.shop_id
      LEFT JOIN subscription_enforcement_log sel ON subs.billing_reference = sel.stripe_subscription_id
      WHERE subs.status = 'active'
        AND subs.next_payment_date IS NOT NULL
        AND subs.next_payment_date < NOW()
        AND subs.billing_reference IS NOT NULL
      ORDER BY subs.next_payment_date ASC
    `;

    const result = await this.pool.query(query);

    return result.rows.map(row => ({
      id: row.id,
      shopId: row.shop_id,
      shopName: row.shop_name,
      shopEmail: row.shop_email,
      stripeSubscriptionId: row.stripe_subscription_id,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      daysOverdue: row.days_overdue,
      lastWarningAt: row.last_warning_at,
      warningCount: row.warning_count || 0
    }));
  }

  /**
   * Enforce a single subscription
   */
  async enforceSubscription(sub: OverdueSubscription): Promise<{
    action: 'none' | 'warned' | 'cancelled' | 'synced';
    synced: boolean;
    message: string;
  }> {
    const { daysOverdue, warningCount, lastWarningAt, shopId, stripeSubscriptionId } = sub;

    logger.info('Enforcing subscription', {
      shopId,
      stripeSubscriptionId,
      daysOverdue,
      warningCount,
      gracePeriodDays: this.config.gracePeriodDays
    });

    // First, sync with Stripe to get latest status
    let synced = false;
    try {
      const subscriptionService = getSubscriptionService();
      await subscriptionService.syncSubscriptionFromStripe(stripeSubscriptionId);
      synced = true;

      // Re-check if still overdue after sync
      const freshSub = await this.getSubscriptionStatus(stripeSubscriptionId);
      if (!freshSub || freshSub.status === 'canceled' || freshSub.currentPeriodEnd > new Date()) {
        logger.info('Subscription no longer overdue after sync', { shopId, stripeSubscriptionId });
        return { action: 'synced', synced: true, message: 'Subscription synced and no longer overdue' };
      }
    } catch (error) {
      logger.warn('Failed to sync subscription from Stripe', {
        shopId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check if beyond grace period - auto-cancel
    if (daysOverdue >= this.config.gracePeriodDays) {
      await this.cancelOverdueSubscription(sub, 'Grace period expired');
      return {
        action: 'cancelled',
        synced,
        message: `Subscription cancelled after ${daysOverdue} days overdue`
      };
    }

    // Check if we should send a warning
    const shouldWarn = this.shouldSendWarning(sub);
    if (shouldWarn) {
      await this.sendWarningAndLog(sub);
      return {
        action: 'warned',
        synced,
        message: `Warning ${warningCount + 1} sent to shop`
      };
    }

    return { action: 'none', synced, message: 'No action needed' };
  }

  /**
   * Determine if we should send a warning
   */
  private shouldSendWarning(sub: OverdueSubscription): boolean {
    const { daysOverdue, warningCount, lastWarningAt } = sub;

    // Don't warn if below warning threshold
    if (daysOverdue < this.config.warningDays) {
      return false;
    }

    // Don't warn if max warnings reached
    if (warningCount >= this.config.maxWarnings) {
      return false;
    }

    // Check if enough time has passed since last warning
    if (lastWarningAt) {
      const daysSinceLastWarning = Math.floor(
        (Date.now() - new Date(lastWarningAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastWarning < this.config.warningIntervalDays) {
        return false;
      }
    }

    return true;
  }

  /**
   * Send warning email and log it
   */
  private async sendWarningAndLog(sub: OverdueSubscription): Promise<void> {
    const { shopId, shopName, shopEmail, stripeSubscriptionId, daysOverdue, warningCount } = sub;
    const gracePeriodRemaining = this.config.gracePeriodDays - daysOverdue;

    // Send email
    try {
      await this.emailService.sendPaymentOverdue({
        shopEmail,
        shopName,
        amountDue: 500, // Monthly subscription amount
        daysOverdue,
        gracePeriodRemaining: Math.max(0, gracePeriodRemaining),
        suspensionDate: new Date(Date.now() + gracePeriodRemaining * 24 * 60 * 60 * 1000)
      });

      logger.info('Sent overdue payment warning email', {
        shopId,
        shopEmail,
        daysOverdue,
        warningNumber: warningCount + 1
      });
    } catch (emailError) {
      logger.error('Failed to send warning email', {
        shopId,
        error: emailError instanceof Error ? emailError.message : 'Unknown error'
      });
    }

    // Log the warning
    await this.logEnforcementAction(stripeSubscriptionId, 'warning', {
      warningCount: warningCount + 1,
      daysOverdue,
      gracePeriodRemaining
    });

    // Publish event
    eventBus.publish({
      type: 'subscription.warning.sent',
      aggregateId: shopId,
      timestamp: new Date(),
      source: 'SubscriptionEnforcementService',
      version: 1,
      data: {
        subscriptionId: stripeSubscriptionId,
        warningCount: warningCount + 1,
        daysOverdue,
        gracePeriodRemaining
      }
    });
  }

  /**
   * Cancel an overdue subscription
   */
  private async cancelOverdueSubscription(sub: OverdueSubscription, reason: string): Promise<void> {
    const { shopId, shopName, shopEmail, stripeSubscriptionId, daysOverdue } = sub;

    logger.info('Auto-cancelling overdue subscription', {
      shopId,
      stripeSubscriptionId,
      daysOverdue,
      reason
    });

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Cancel in Stripe
      try {
        const stripeService = getStripeService();
        await stripeService.cancelSubscription(stripeSubscriptionId, true); // Immediately
      } catch (stripeError) {
        logger.warn('Failed to cancel in Stripe (may already be cancelled)', {
          shopId,
          error: stripeError instanceof Error ? stripeError.message : 'Unknown error'
        });
      }

      // Update stripe_subscriptions table
      await client.query(`
        UPDATE stripe_subscriptions
        SET status = 'canceled',
            canceled_at = NOW(),
            updated_at = NOW()
        WHERE stripe_subscription_id = $1
      `, [stripeSubscriptionId]);

      // Update shop_subscriptions table
      await client.query(`
        UPDATE shop_subscriptions
        SET status = 'cancelled',
            is_active = false,
            cancelled_at = NOW(),
            cancellation_reason = $1
        WHERE shop_id = $2 AND status IN ('active', 'past_due')
      `, [`Auto-cancelled: ${reason} (${daysOverdue} days overdue)`, shopId]);

      // Update shop operational_status
      const shopResult = await client.query(`
        SELECT rcg_balance FROM shops WHERE shop_id = $1
      `, [shopId]);

      const rcgBalance = shopResult.rows[0]?.rcg_balance || 0;
      const newStatus = rcgBalance >= 10000 ? 'rcg_qualified' : 'not_qualified';

      await client.query(`
        UPDATE shops
        SET operational_status = $1,
            updated_at = NOW()
        WHERE shop_id = $2
      `, [newStatus, shopId]);

      // Log the enforcement action
      await this.logEnforcementActionWithClient(client, stripeSubscriptionId, 'cancelled', {
        daysOverdue,
        reason,
        newOperationalStatus: newStatus
      });

      await client.query('COMMIT');

      // Send cancellation email
      try {
        await this.emailService.sendSubscriptionDefaulted({
          shopEmail,
          shopName,
          amountDue: 500,
          daysPastDue: daysOverdue
        });
      } catch (emailError) {
        logger.error('Failed to send cancellation email', {
          shopId,
          error: emailError instanceof Error ? emailError.message : 'Unknown error'
        });
      }

      // Publish event
      eventBus.publish({
        type: 'subscription.auto_cancelled',
        aggregateId: shopId,
        timestamp: new Date(),
        source: 'SubscriptionEnforcementService',
        version: 1,
        data: {
          subscriptionId: stripeSubscriptionId,
          daysOverdue,
          reason,
          newOperationalStatus: newStatus
        }
      });

      logger.info('Subscription auto-cancelled successfully', {
        shopId,
        stripeSubscriptionId,
        daysOverdue,
        newOperationalStatus: newStatus
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to cancel overdue subscription', {
        shopId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Log enforcement action
   */
  private async logEnforcementAction(
    stripeSubscriptionId: string,
    action: 'warning' | 'cancelled',
    details: Record<string, any>
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await this.logEnforcementActionWithClient(client, stripeSubscriptionId, action, details);
    } finally {
      client.release();
    }
  }

  private async logEnforcementActionWithClient(
    client: any,
    stripeSubscriptionId: string,
    action: 'warning' | 'cancelled',
    details: Record<string, any>
  ): Promise<void> {
    if (action === 'warning') {
      // Upsert enforcement log
      await client.query(`
        INSERT INTO subscription_enforcement_log (
          stripe_subscription_id,
          last_warning_at,
          warning_count,
          details
        )
        VALUES ($1, NOW(), 1, $2)
        ON CONFLICT (stripe_subscription_id)
        DO UPDATE SET
          last_warning_at = NOW(),
          warning_count = subscription_enforcement_log.warning_count + 1,
          details = $2,
          updated_at = NOW()
      `, [stripeSubscriptionId, JSON.stringify(details)]);
    } else if (action === 'cancelled') {
      await client.query(`
        INSERT INTO subscription_enforcement_log (
          stripe_subscription_id,
          cancelled_at,
          cancellation_reason,
          details
        )
        VALUES ($1, NOW(), $2, $3)
        ON CONFLICT (stripe_subscription_id)
        DO UPDATE SET
          cancelled_at = NOW(),
          cancellation_reason = $2,
          details = $3,
          updated_at = NOW()
      `, [stripeSubscriptionId, details.reason || 'Auto-cancelled', JSON.stringify(details)]);
    }
  }

  /**
   * Get current subscription status from database
   */
  private async getSubscriptionStatus(stripeSubscriptionId: string): Promise<SubscriptionData | null> {
    // Check shop_subscriptions first (more reliable for overdue status)
    const query = `
      SELECT
        subs.*,
        ss.stripe_customer_id,
        ss.stripe_price_id,
        ss.current_period_start,
        ss.cancel_at_period_end,
        ss.canceled_at,
        ss.ended_at,
        ss.metadata
      FROM shop_subscriptions subs
      LEFT JOIN stripe_subscriptions ss ON subs.billing_reference = ss.stripe_subscription_id
      WHERE subs.billing_reference = $1
    `;
    const result = await this.pool.query(query, [stripeSubscriptionId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      shopId: row.shop_id,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.billing_reference,
      stripePriceId: row.stripe_price_id,
      status: row.status === 'cancelled' ? 'canceled' : row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.next_payment_date, // Use next_payment_date from shop_subscriptions
      cancelAtPeriodEnd: row.cancel_at_period_end,
      canceledAt: row.canceled_at || row.cancelled_at,
      endedAt: row.ended_at,
      trialEnd: null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Enforce subscription for a specific shop (on-demand check)
   */
  async enforceForShop(shopId: string): Promise<{
    isValid: boolean;
    action?: string;
    message: string;
  }> {
    const query = `
      SELECT
        ss.id,
        ss.shop_id,
        ss.stripe_subscription_id,
        ss.status,
        ss.current_period_end,
        s.name as shop_name,
        s.email as shop_email,
        COALESCE(sel.last_warning_at, NULL) as last_warning_at,
        COALESCE(sel.warning_count, 0) as warning_count,
        EXTRACT(DAY FROM NOW() - ss.current_period_end)::int as days_overdue
      FROM stripe_subscriptions ss
      JOIN shops s ON ss.shop_id = s.shop_id
      LEFT JOIN subscription_enforcement_log sel ON ss.stripe_subscription_id = sel.stripe_subscription_id
      WHERE ss.shop_id = $1 AND ss.status IN ('active', 'past_due', 'unpaid')
      ORDER BY ss.created_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [shopId]);

    if (result.rows.length === 0) {
      return { isValid: false, message: 'No active subscription found' };
    }

    const row = result.rows[0];
    const currentPeriodEnd = new Date(row.current_period_end);

    // Check if subscription is current
    if (currentPeriodEnd > new Date()) {
      return { isValid: true, message: 'Subscription is current' };
    }

    const daysOverdue = row.days_overdue;

    // If overdue but within grace period, allow but log
    if (daysOverdue < this.config.gracePeriodDays) {
      logger.warn('Shop subscription overdue but within grace period', {
        shopId,
        daysOverdue,
        gracePeriodDays: this.config.gracePeriodDays
      });
      return {
        isValid: true,
        message: `Subscription overdue by ${daysOverdue} days (grace period: ${this.config.gracePeriodDays} days)`
      };
    }

    // Beyond grace period - enforce
    const sub: OverdueSubscription = {
      id: row.id,
      shopId: row.shop_id,
      shopName: row.shop_name,
      shopEmail: row.shop_email,
      stripeSubscriptionId: row.stripe_subscription_id,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      daysOverdue: row.days_overdue,
      lastWarningAt: row.last_warning_at,
      warningCount: row.warning_count || 0
    };

    const enforceResult = await this.enforceSubscription(sub);

    if (enforceResult.action === 'cancelled') {
      return { isValid: false, action: 'cancelled', message: enforceResult.message };
    }

    return { isValid: false, action: enforceResult.action, message: enforceResult.message };
  }

  /**
   * Get enforcement statistics for admin dashboard
   */
  async getEnforcementStats(): Promise<{
    totalOverdue: number;
    warningsSent: number;
    pendingCancellation: number;
    cancelledThisMonth: number;
    overdueByDays: { days: string; count: number }[];
  }> {
    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE ss.current_period_end < NOW()) as total_overdue,
        COUNT(*) FILTER (WHERE sel.warning_count > 0) as warnings_sent,
        COUNT(*) FILTER (
          WHERE ss.current_period_end < NOW() - INTERVAL '${this.config.gracePeriodDays - 3} days'
            AND ss.current_period_end >= NOW() - INTERVAL '${this.config.gracePeriodDays} days'
        ) as pending_cancellation,
        COUNT(*) FILTER (
          WHERE sel.cancelled_at >= DATE_TRUNC('month', NOW())
        ) as cancelled_this_month
      FROM stripe_subscriptions ss
      LEFT JOIN subscription_enforcement_log sel ON ss.stripe_subscription_id = sel.stripe_subscription_id
      WHERE ss.status IN ('active', 'past_due', 'unpaid', 'canceled')
    `;

    const distributionQuery = `
      SELECT
        CASE
          WHEN EXTRACT(DAY FROM NOW() - current_period_end) BETWEEN 1 AND 3 THEN '1-3 days'
          WHEN EXTRACT(DAY FROM NOW() - current_period_end) BETWEEN 4 AND 7 THEN '4-7 days'
          WHEN EXTRACT(DAY FROM NOW() - current_period_end) BETWEEN 8 AND 14 THEN '8-14 days'
          WHEN EXTRACT(DAY FROM NOW() - current_period_end) > 14 THEN '14+ days'
        END as days,
        COUNT(*) as count
      FROM stripe_subscriptions
      WHERE status IN ('active', 'past_due', 'unpaid')
        AND current_period_end < NOW()
      GROUP BY days
      ORDER BY
        CASE days
          WHEN '1-3 days' THEN 1
          WHEN '4-7 days' THEN 2
          WHEN '8-14 days' THEN 3
          WHEN '14+ days' THEN 4
        END
    `;

    const [statsResult, distributionResult] = await Promise.all([
      this.pool.query(statsQuery),
      this.pool.query(distributionQuery)
    ]);

    const stats = statsResult.rows[0];

    return {
      totalOverdue: parseInt(stats.total_overdue) || 0,
      warningsSent: parseInt(stats.warnings_sent) || 0,
      pendingCancellation: parseInt(stats.pending_cancellation) || 0,
      cancelledThisMonth: parseInt(stats.cancelled_this_month) || 0,
      overdueByDays: distributionResult.rows.map(row => ({
        days: row.days,
        count: parseInt(row.count)
      }))
    };
  }
}

// Singleton instance
let enforcementService: SubscriptionEnforcementService | null = null;

export function getSubscriptionEnforcementService(): SubscriptionEnforcementService {
  if (!enforcementService) {
    enforcementService = new SubscriptionEnforcementService();
  }
  return enforcementService;
}

export function startSubscriptionEnforcement(schedule?: string): void {
  const service = getSubscriptionEnforcementService();
  service.startCronJob(schedule);
}

export function stopSubscriptionEnforcement(): void {
  if (enforcementService) {
    enforcementService.stopCronJob();
  }
}
