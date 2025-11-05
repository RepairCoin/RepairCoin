import { Pool } from 'pg';
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
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if shop already has an active subscription
      const existingQuery = `
        SELECT s.*, sc.stripe_customer_id 
        FROM stripe_subscriptions s
        JOIN stripe_customers sc ON s.stripe_customer_id = sc.stripe_customer_id
        WHERE s.shop_id = $1 AND s.status IN ('active', 'past_due', 'unpaid')
      `;
      const existingResult = await client.query(existingQuery, [shopId]);
      
      if (existingResult.rows.length > 0) {
        throw new Error('Shop already has an active subscription');
      }

      // Get or create Stripe customer
      let customer = await this.getCustomerByShopId(shopId);
      
      if (!customer) {
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
        const customerResult = await client.query(customerQuery, [
          shopId,
          stripeCustomer.id,
          email,
          name
        ]);
        
        customer = this.mapCustomerRow(customerResult.rows[0]);
      }

      // Get price ID from environment
      const priceId = process.env.STRIPE_MONTHLY_PRICE_ID!;

      // Create Stripe subscription
      const stripeSubscription = await this.stripeService.createSubscription({
        customerId: customer.stripeCustomerId,
        priceId,
        paymentMethodId,
        metadata: { shopId }
      });
      
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
    
    console.log('🔍 SUBSCRIPTION SERVICE - Database query result for shop:', {
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
    const query = `
      INSERT INTO stripe_subscriptions (
        shop_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, 
        status, metadata, current_period_start, current_period_end, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [
      params.shopId,
      params.stripeCustomerId,
      params.stripeSubscriptionId,
      params.stripePriceId,
      params.status,
      JSON.stringify(params.metadata || {}),
      params.currentPeriodStart || new Date(),
      params.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    ]);
    
    return this.mapSubscriptionRow(result.rows[0]);
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(stripeSubscriptionId: string): Promise<SubscriptionData> {
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

      // Pause in Stripe by setting pause_collection
      await this.stripeService.pauseSubscription(stripeSubscriptionId);

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

      try {
        // Try to resume in Stripe - this will fail if not actually paused in Stripe
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
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current subscription from database
      const query = 'SELECT * FROM stripe_subscriptions WHERE stripe_subscription_id = $1';
      const result = await client.query(query, [stripeSubscriptionId]);

      if (result.rows.length === 0) {
        throw new Error('Subscription not found in database');
      }

      // Fetch latest data from Stripe
      const stripeSubscription = await this.stripeService.getSubscription(stripeSubscriptionId);

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

      // Validate timestamps before converting
      if (!currentPeriodStart || !currentPeriodEnd) {
        throw new Error('Missing required period dates from Stripe subscription');
      }

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
        new Date(currentPeriodStart * 1000),
        new Date(currentPeriodEnd * 1000),
        stripeSubscription.cancel_at_period_end || false,
        canceledAt ? new Date(canceledAt * 1000) : null,
        stripeSubscriptionId
      ]);

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
  async cancelSubscription(shopId: string, immediately: boolean = false): Promise<SubscriptionData> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get active subscription
      const subscription = await this.getActiveSubscription(shopId);
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Cancel in Stripe
      const updatedStripeSubscription = await this.stripeService.cancelSubscription(
        subscription.stripeSubscriptionId,
        immediately
      );

      // Update subscription in database
      const updateQuery = `
        UPDATE stripe_subscriptions 
        SET 
          status = $1,
          cancel_at_period_end = $2,
          canceled_at = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE stripe_subscription_id = $4
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        updatedStripeSubscription.status,
        updatedStripeSubscription.cancel_at_period_end,
        updatedStripeSubscription.canceled_at ? new Date(updatedStripeSubscription.canceled_at * 1000) : new Date(),
        subscription.stripeSubscriptionId
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

      logger.info('Subscription canceled successfully', {
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