import Stripe from 'stripe';
import { logger } from '../utils/logger';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  priceId: string; // Monthly subscription price ID
  isTestMode: boolean;
}

export interface CreateCustomerData {
  email: string;
  name: string;
  shopId: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionData {
  customerId: string;
  priceId: string;
  paymentMethodId?: string;
  trialPeriodDays?: number;
  metadata?: Record<string, string>;
}

export interface UpdatePaymentMethodData {
  customerId: string;
  paymentMethodId: string;
}

export class StripeService {
  private stripe: Stripe;
  private config: StripeConfig;

  constructor(config: StripeConfig) {
    this.config = config;
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    });

    logger.info('StripeService initialized', {
      testMode: config.isTestMode,
      priceId: config.priceId
    });
  }

  /**
   * Create a new Stripe customer
   */
  async createCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email: data.email,
        name: data.name,
        metadata: {
          shopId: data.shopId,
          environment: this.config.isTestMode ? 'test' : 'production',
          ...data.metadata
        }
      });

      logger.info('Stripe customer created', {
        customerId: customer.id,
        shopId: data.shopId,
        email: data.email
      });

      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: data.shopId,
        email: data.email
      });
      throw new Error(`Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(data: CreateSubscriptionData): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: data.customerId,
        items: [{
          price: data.priceId,
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card'],
        },
        expand: ['latest_invoice.payment_intent', 'customer'],
        metadata: {
          environment: this.config.isTestMode ? 'test' : 'production',
          ...data.metadata
        }
      };

      // Add payment method if provided
      if (data.paymentMethodId) {
        subscriptionData.default_payment_method = data.paymentMethodId;
      }

      // Add trial period if provided
      if (data.trialPeriodDays) {
        subscriptionData.trial_period_days = data.trialPeriodDays;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      logger.info('Stripe subscription created', {
        subscriptionId: subscription.id,
        customerId: data.customerId,
        status: subscription.status
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to create Stripe subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId: data.customerId
      });
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update subscription payment method
   */
  async updateSubscriptionPaymentMethod(subscriptionId: string, paymentMethodId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        default_payment_method: paymentMethodId,
      });

      logger.info('Subscription payment method updated', {
        subscriptionId,
        paymentMethodId
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to update subscription payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId,
        paymentMethodId
      });
      throw new Error(`Failed to update payment method: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: !immediately,
        ...(immediately && { prorate: true })
      });

      if (immediately) {
        await this.stripe.subscriptions.cancel(subscriptionId);
      }

      logger.info('Subscription canceled', {
        subscriptionId,
        immediately,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to cancel subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId
      });
      throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retry failed payment
   */
  async retryPayment(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.pay(invoiceId, {
        forgive: false, // Don't forgive the debt
      });

      logger.info('Payment retry attempted', {
        invoiceId,
        status: invoice.status,
        amountDue: invoice.amount_due
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to retry payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId
      });
      throw new Error(`Failed to retry payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get customer with payment methods
   */
  async getCustomerWithPaymentMethods(customerId: string): Promise<{
    customer: Stripe.Customer;
    paymentMethods: Stripe.PaymentMethod[];
  }> {
    try {
      const [customer, paymentMethods] = await Promise.all([
        this.stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>,
        this.stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        })
      ]);

      return {
        customer,
        paymentMethods: paymentMethods.data
      };
    } catch (error) {
      logger.error('Failed to get customer with payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId
      });
      throw new Error(`Failed to get customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create payment intent for one-time payment
   */
  async createPaymentIntent(data: {
    amount: number;
    currency: string;
    customerId?: string;
    paymentMethodId?: string;
    metadata?: Record<string, string>;
    description?: string;
  }): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: data.amount,
        currency: data.currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          environment: this.config.isTestMode ? 'test' : 'production',
          ...data.metadata
        }
      };

      if (data.customerId) {
        paymentIntentData.customer = data.customerId;
      }

      if (data.paymentMethodId) {
        paymentIntentData.payment_method = data.paymentMethodId;
      }

      if (data.description) {
        paymentIntentData.description = data.description;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount: data.amount,
        currency: data.currency,
        customerId: data.customerId
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to create payment intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        amount: data.amount,
        customerId: data.customerId
      });
      throw new Error(`Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create setup intent for saving payment method
   */
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: {
          environment: this.config.isTestMode ? 'test' : 'production'
        }
      });

      logger.info('Setup intent created', {
        setupIntentId: setupIntent.id,
        customerId
      });

      return setupIntent;
    } catch (error) {
      logger.error('Failed to create setup intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId
      });
      throw new Error(`Failed to create setup intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer', 'default_payment_method']
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to get subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId
      });
      throw new Error(`Failed to get subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(payload: string | Buffer, signature: string): Promise<Stripe.Event> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.webhookSecret
      );

      logger.info('Stripe webhook received', {
        eventType: event.type,
        eventId: event.id
      });

      return event;
    } catch (error) {
      logger.error('Failed to verify webhook signature', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Webhook signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get invoice details
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId, {
        expand: ['subscription', 'payment_intent']
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to get invoice', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId
      });
      throw new Error(`Failed to get invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update customer details
   */
  async updateCustomer(customerId: string, data: Partial<Stripe.CustomerUpdateParams>): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, data);

      logger.info('Customer updated', {
        customerId: customer.id
      });

      return customer;
    } catch (error) {
      logger.error('Failed to update customer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId
      });
      throw new Error(`Failed to update customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the raw Stripe instance for advanced operations
   */
  getStripe(): Stripe {
    return this.stripe;
  }
}

// Singleton instance
let stripeService: StripeService | null = null;

export function getStripeService(): StripeService {
  if (!stripeService) {
    const config: StripeConfig = {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      priceId: process.env.STRIPE_MONTHLY_PRICE_ID || '',
      isTestMode: process.env.NODE_ENV !== 'production' || process.env.STRIPE_SECRET_KEY?.includes('test') || false
    };

    if (!config.secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    if (!config.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    if (!config.priceId) {
      throw new Error('STRIPE_MONTHLY_PRICE_ID environment variable is required');
    }

    stripeService = new StripeService(config);
  }

  return stripeService;
}