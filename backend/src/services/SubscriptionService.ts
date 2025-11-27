import { getStripeService, StripeService } from './StripeService';
import { logger } from '../utils/logger';
import { BaseRepository } from '../repositories/BaseRepository';
import { eventBus } from '../events/EventBus';

export interface SubscriptionData {
  id: number;
  shopId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  endedAt?: Date;
  trialEnd?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerData {
  id: number;
  shopId: string;
  stripeCustomerId: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SubscriptionService extends BaseRepository {
  private stripeService: StripeService;

  constructor() {
    super();
    this.stripeService = getStripeService();
  }

  /**
   * Create a new subscription for a shop
   */
  async createSubscription(shopId: string, email: string, name: string, paymentMethodId?: string): Promise<{
    subscription: SubscriptionData;
    clientSecret?: string;
  }> {
    // Check for existing active subscription BEFORE doing anything
    const existingSubscription = await this.getActiveSubscription(shopId);
    if (existingSubscription) {
      throw new Error('Shop already has an active subscription');
    }

    // Get or create customer BEFORE acquiring connection
    let customer = await this.getCustomerByShopId(shopId);

    if (!customer) {
      // Create Stripe customer first
      const stripeCustomer = await this.stripeService.createCustomer({
        email,
        name,
        shopId,
        metadata: { shopId }
      });

      // Save customer to database
      const customerQuery = `
        INSERT INTO stripe_customers (shop_id, stripe_customer_id, email, name)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const customerResult = await this.pool.query(customerQuery, [
        shopId,
        stripeCustomer.id,
        email,
        name
      ]);

      customer = this.mapCustomerRow(customerResult.rows[0]);
    }

    // Get price ID from environment
    const priceId = process.env.STRIPE_MONTHLY_PRICE_ID!;

    // Create Stripe subscription BEFORE acquiring connection
    const stripeSubscription = await this.stripeService.createSubscription({
      customerId: customer.stripeCustomerId,
      priceId,
      paymentMethodId,
      metadata: { shopId }
    });

    // NOW acquire connection only for final database insert
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      
      logger.debug('Stripe subscription object structure', {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        current_period_start: (stripeSubscription as any).current_period_start,
        current_period_end: (stripeSubscription as any).current_period_end,
        hasLatestInvoice: !!stripeSubscription.latest_invoice
      });

      // Save subscription to database
      const subscriptionQuery = `
        INSERT INTO stripe_subscriptions (
          shop_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
          status, current_period_start, current_period_end, cancel_at_period_end,
          trial_end, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      // Extract dates from Stripe subscription
      const currentPeriodStart = (stripeSubscription as any).current_period_start || 
                                 (stripeSubscription as any).currentPeriodStart ||
                                 Math.floor(Date.now() / 1000);
      const currentPeriodEnd = (stripeSubscription as any).current_period_end || 
                               (stripeSubscription as any).currentPeriodEnd ||
                               Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
      
      const subscriptionResult = await client.query(subscriptionQuery, [
        shopId,
        customer.stripeCustomerId,
        stripeSubscription.id,
        priceId,
        stripeSubscription.status,
        new Date(currentPeriodStart * 1000),
        new Date(currentPeriodEnd * 1000),
        stripeSubscription.cancel_at_period_end || false,
        stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        JSON.stringify(stripeSubscription.metadata || {})
      ]);

      await client.query('COMMIT');

      const subscription = this.mapSubscriptionRow(subscriptionResult.rows[0]);

      // Publish event
      eventBus.publish({
        type: 'subscription.created',
        aggregateId: shopId,
        timestamp: new Date(),
        source: 'SubscriptionService',
        version: 1,
        data: { 
          subscriptionId: subscription.stripeSubscriptionId,
          status: subscription.status,
          priceId: subscription.stripePriceId
        }
      });

      logger.info('Subscription created successfully', {
        shopId,
        subscriptionId: subscription.stripeSubscriptionId,
        status: subscription.status
      });

      // Extract client secret if payment requires confirmation
      let clientSecret: string | undefined;
      if (stripeSubscription.latest_invoice && 
          typeof stripeSubscription.latest_invoice === 'object' &&
          (stripeSubscription.latest_invoice as any).payment_intent &&
          typeof (stripeSubscription.latest_invoice as any).payment_intent === 'object') {
        clientSecret = ((stripeSubscription.latest_invoice as any).payment_intent as any).client_secret || undefined;
      }

      return { subscription, clientSecret };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create subscription', {
        shopId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active subscription for shop
   */
  async getActiveSubscription(shopId: string): Promise<SubscriptionData | null> {
    const query = `
      SELECT * FROM stripe_subscriptions
      WHERE shop_id = $1 AND status IN ('active', 'past_due', 'unpaid')
      ORDER BY created_at DESC LIMIT 1
    `;
    const result = await this.pool.query(query, [shopId]);

    logger.debug('SUBSCRIPTION SERVICE - Database query result for shop:', {
      shopId,
      rowsFound: result.rows.length,
      subscriptions: result.rows.map(row => ({
        id: row.id,
        stripe_subscription_id: row.stripe_subscription_id,
        status: row.status,
        created_at: row.created_at
      }))
    });

    return result.rows.length > 0 ? this.mapSubscriptionRow(result.rows[0]) : null;
  }

  /**
   * Get customer by shop ID
   */
  async getCustomerByShopId(shopId: string): Promise<CustomerData | null> {
    const query = `SELECT * FROM stripe_customers WHERE shop_id = $1`;
    const result = await this.pool.query(query, [shopId]);
    
    return result.rows.length > 0 ? this.mapCustomerRow(result.rows[0]) : null;
  }

  /**
   * Create a subscription record in the database (used for tracking pending subscriptions)
   */
  async createSubscriptionRecord(params: {
    shopId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    status: 'incomplete' | 'active' | 'past_due' | 'canceled' | 'unpaid';
    metadata?: Record<string, any>;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }): Promise<SubscriptionData> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO stripe_subscriptions (
          shop_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
          status, metadata, current_period_start, current_period_end, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await client.query(query, [
        params.shopId,
        params.stripeCustomerId,
        params.stripeSubscriptionId,
        params.stripePriceId,
        params.status,
        JSON.stringify(params.metadata || {}),
        params.currentPeriodStart || new Date(),
        params.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      ]);

      // Update shop operational_status if subscription is active
      const activeStatuses = ['active', 'past_due', 'unpaid'];
      if (activeStatuses.includes(params.status)) {
        const updateShopQuery = `
          UPDATE shops
          SET operational_status = 'subscription_qualified',
              updated_at = CURRENT_TIMESTAMP
          WHERE shop_id = $1
        `;
        await client.query(updateShopQuery, [params.shopId]);

        logger.info('Shop operational status set to subscription_qualified', {
          shopId: params.shopId,
          subscriptionId: params.stripeSubscriptionId,
          subscriptionStatus: params.status
        });
      }

      await client.query('COMMIT');

      return this.mapSubscriptionRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create subscription record', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(stripeSubscriptionId: string): Promise<SubscriptionData> {
    // Pause in Stripe BEFORE acquiring connection
    await this.stripeService.pauseSubscription(stripeSubscriptionId);

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get subscription from database
      const query = 'SELECT * FROM stripe_subscriptions WHERE stripe_subscription_id = $1';
      const result = await client.query(query, [stripeSubscriptionId]);

      if (result.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = this.mapSubscriptionRow(result.rows[0]);

      // Update subscription in database with 'paused' status
      const updateQuery = `
        UPDATE stripe_subscriptions
        SET
          status = 'paused',
          updated_at = CURRENT_TIMESTAMP
        WHERE stripe_subscription_id = $1
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        stripeSubscriptionId
      ]);

      await client.query('COMMIT');

      const updatedSubscription = this.mapSubscriptionRow(updateResult.rows[0]);

      // Publish event
      eventBus.publish({
        type: 'subscription.paused',
        aggregateId: subscription.shopId,
        timestamp: new Date(),
        source: 'SubscriptionService',
        version: 1,
        data: {
          subscriptionId: stripeSubscriptionId,
          status: updatedSubscription.status
        }
      });

      logger.info('Subscription paused successfully', {
        shopId: subscription.shopId,
        subscriptionId: stripeSubscriptionId,
        status: updatedSubscription.status
      });

      return updatedSubscription;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to pause subscription', {
        stripeSubscriptionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(stripeSubscriptionId: string): Promise<SubscriptionData> {
    // Try to resume in Stripe BEFORE acquiring connection
    try {
      await this.stripeService.resumeSubscription(stripeSubscriptionId);
      logger.info('Successfully resumed subscription in Stripe', { stripeSubscriptionId });
    } catch (stripeError) {
      // If Stripe says it's not paused, just log it and continue
      // We'll still update our database status
      logger.warn('Stripe resume failed, subscription may not have been paused in Stripe', {
        stripeSubscriptionId,
        error: stripeError instanceof Error ? stripeError.message : 'Unknown error'
      });
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get subscription from database
      const query = 'SELECT * FROM stripe_subscriptions WHERE stripe_subscription_id = $1';
      const result = await client.query(query, [stripeSubscriptionId]);

      if (result.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = this.mapSubscriptionRow(result.rows[0]);

      // Update subscription in database with 'active' status
      const updateQuery = `
        UPDATE stripe_subscriptions
        SET
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
        WHERE stripe_subscription_id = $1
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        stripeSubscriptionId
      ]);

      // Update shop operational_status to subscription_qualified
      const updateShopQuery = `
        UPDATE shops
        SET operational_status = 'subscription_qualified',
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $1
      `;
      await client.query(updateShopQuery, [subscription.shopId]);

      logger.info('Shop operational status updated after subscription resume', {
        shopId: subscription.shopId,
        subscriptionId: stripeSubscriptionId,
        operationalStatus: 'subscription_qualified'
      });

      await client.query('COMMIT');

      const updatedSubscription = this.mapSubscriptionRow(updateResult.rows[0]);

      // Publish event
      eventBus.publish({
        type: 'subscription.resumed',
        aggregateId: subscription.shopId,
        timestamp: new Date(),
        source: 'SubscriptionService',
        version: 1,
        data: {
          subscriptionId: stripeSubscriptionId,
          status: updatedSubscription.status
        }
      });

      logger.info('Subscription resumed successfully', {
        shopId: subscription.shopId,
        subscriptionId: stripeSubscriptionId,
        status: updatedSubscription.status
      });

      return updatedSubscription;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to resume subscription', {
        stripeSubscriptionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Sync subscription status from Stripe
   * Fetches the latest subscription data from Stripe and updates the database
   */
  async syncSubscriptionFromStripe(stripeSubscriptionId: string): Promise<SubscriptionData> {
    // Fetch from Stripe BEFORE acquiring connection to avoid holding connection during API call
    const stripeSubscription = await this.stripeService.getSubscription(stripeSubscriptionId);

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current subscription from database
      const query = 'SELECT * FROM stripe_subscriptions WHERE stripe_subscription_id = $1';
      const result = await client.query(query, [stripeSubscriptionId]);

      if (result.rows.length === 0) {
        throw new Error('Subscription not found in database');
      }

      // Determine the actual status based on Stripe data
      let actualStatus = stripeSubscription.status;

      // Check if subscription is paused via pause_collection
      if (stripeSubscription.pause_collection && stripeSubscription.status === 'active') {
        actualStatus = 'paused';
      }

      // Safely extract timestamps from Stripe subscription
      const currentPeriodStart = (stripeSubscription as any).current_period_start;
      const currentPeriodEnd = (stripeSubscription as any).current_period_end;
      const canceledAt = stripeSubscription.canceled_at;

      // Log the subscription data for debugging
      logger.info('Stripe subscription data received', {
        subscriptionId: stripeSubscriptionId,
        status: stripeSubscription.status,
        hasPeriodStart: !!currentPeriodStart,
        hasPeriodEnd: !!currentPeriodEnd,
        periodStart: currentPeriodStart,
        periodEnd: currentPeriodEnd,
        canceledAt: canceledAt
      });

      // For canceled subscriptions, use fallback dates if period dates are missing
      const periodStart = currentPeriodStart
        ? new Date(currentPeriodStart * 1000)
        : new Date(); // Fallback to current date

      const periodEnd = currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Fallback to 30 days from now

      // Update database with latest Stripe data
      const updateQuery = `
        UPDATE stripe_subscriptions
        SET
          status = $1,
          current_period_start = $2,
          current_period_end = $3,
          cancel_at_period_end = $4,
          canceled_at = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE stripe_subscription_id = $6
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        actualStatus,
        periodStart,
        periodEnd,
        stripeSubscription.cancel_at_period_end || false,
        canceledAt ? new Date(canceledAt * 1000) : null,
        stripeSubscriptionId
      ]);

      // Update shop operational_status based on subscription status
      const shopId = updateResult.rows[0].shop_id;
      const activeStatuses = ['active', 'past_due', 'unpaid'];
      const isActive = activeStatuses.includes(actualStatus);

      // Get shop's RCG balance to determine operational status
      const shopQuery = `SELECT rcg_balance FROM shops WHERE shop_id = $1`;
      const shopResult = await client.query(shopQuery, [shopId]);

      if (shopResult.rows.length > 0) {
        const rcgBalance = shopResult.rows[0].rcg_balance || 0;
        let operationalStatus: string;

        if (isActive) {
          operationalStatus = 'subscription_qualified';
        } else if (rcgBalance >= 10000) {
          operationalStatus = 'rcg_qualified';
        } else {
          operationalStatus = 'not_qualified';
        }

        // Update shop operational status
        const updateShopQuery = `
          UPDATE shops
          SET operational_status = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE shop_id = $2
        `;
        await client.query(updateShopQuery, [operationalStatus, shopId]);

        logger.info('Shop operational status updated during subscription sync', {
          shopId,
          subscriptionId: stripeSubscriptionId,
          subscriptionStatus: actualStatus,
          operationalStatus,
          rcgBalance
        });
      }

      await client.query('COMMIT');

      logger.info('Subscription synced from Stripe', {
        subscriptionId: stripeSubscriptionId,
        status: actualStatus,
        stripeStatus: stripeSubscription.status,
        hasPauseCollection: !!stripeSubscription.pause_collection
      });

      return this.mapSubscriptionRow(updateResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to sync subscription from Stripe', {
        stripeSubscriptionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(shopId: string, immediately: boolean = false, reason?: string): Promise<SubscriptionData> {
    // Get active subscription BEFORE acquiring a connection to avoid pool deadlock
    const subscription = await this.getActiveSubscription(shopId);
    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Cancel in Stripe BEFORE acquiring connection
    const updatedStripeSubscription = await this.stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately
    );

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update stripe_subscriptions table
      const updateStripeQuery = `
        UPDATE stripe_subscriptions
        SET
          status = $1,
          cancel_at_period_end = $2,
          canceled_at = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE stripe_subscription_id = $4
        RETURNING *
      `;

      const updateResult = await client.query(updateStripeQuery, [
        updatedStripeSubscription.status,
        updatedStripeSubscription.cancel_at_period_end,
        updatedStripeSubscription.canceled_at ? new Date(updatedStripeSubscription.canceled_at * 1000) : new Date(),
        subscription.stripeSubscriptionId
      ]);

      // Also update shop_subscriptions table for consistency
      const updateShopSubQuery = `
        UPDATE shop_subscriptions
        SET
          status = 'cancelled',
          is_active = false,
          cancelled_at = $1,
          cancellation_reason = $2
        WHERE shop_id = $3 AND status = 'active'
      `;

      await client.query(updateShopSubQuery, [
        new Date(),
        reason || 'Cancelled by shop owner',
        shopId
      ]);

      await client.query('COMMIT');

      const updatedSubscription = this.mapSubscriptionRow(updateResult.rows[0]);

      // Publish event
      eventBus.publish({
        type: 'subscription.canceled',
        aggregateId: shopId,
        timestamp: new Date(),
        source: 'SubscriptionService',
        version: 1,
        data: {
          subscriptionId: subscription.stripeSubscriptionId,
          immediately,
          cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd
        }
      });

      logger.info('Subscription canceled successfully in both tables', {
        shopId,
        subscriptionId: subscription.stripeSubscriptionId,
        immediately,
        status: updatedSubscription.status
      });

      return updatedSubscription;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to cancel subscription', {
        shopId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // Row mapping methods
  private mapSubscriptionRow(row: any): SubscriptionData {
    return {
      id: row.id,
      shopId: row.shop_id,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripePriceId: row.stripe_price_id,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      canceledAt: row.canceled_at,
      endedAt: row.ended_at,
      trialEnd: row.trial_end,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapCustomerRow(row: any): CustomerData {
    return {
      id: row.id,
      shopId: row.shop_id,
      stripeCustomerId: row.stripe_customer_id,
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Singleton instance
let subscriptionService: SubscriptionService | null = null;

export function getSubscriptionService(): SubscriptionService {
  if (!subscriptionService) {
    subscriptionService = new SubscriptionService();
  }
  return subscriptionService;
}