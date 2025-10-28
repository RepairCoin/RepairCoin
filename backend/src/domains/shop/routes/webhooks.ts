import { Router, Request, Response } from 'express';
import { getStripeService } from '../../../services/StripeService';
import { getSubscriptionService } from '../../../services/SubscriptionService';
import { getPaymentRetryService } from '../../../services/PaymentRetryService';
import { logger } from '../../../utils/logger';
import { eventBus } from '../../../events/EventBus';
import { DatabaseService } from '../../../services/DatabaseService';
import { shopPurchaseService } from '../services/ShopPurchaseService';
import Stripe from 'stripe';

const router = Router();

/**
 * @swagger
 * /api/shops/webhooks/stripe:
 *   post:
 *     summary: Handle Stripe webhook events
 *     tags: [Shop Subscriptions]
 *     description: Process Stripe webhook events for subscription management, payment failures, and retry logic
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Stripe webhook event payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid webhook signature or payload
 *       500:
 *         description: Server error processing webhook
 */
router.post('/stripe', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  
  if (!signature) {
    logger.warn('Missing Stripe signature header');
    return res.status(400).json({
      success: false,
      error: 'Missing stripe-signature header'
    });
  }

  try {
    const stripeService = getStripeService();
    const subscriptionService = getSubscriptionService();
    const paymentRetryService = getPaymentRetryService();
    
    // Verify webhook signature and construct event
    const event = await stripeService.handleWebhook(req.body, signature);
    
    // Log the event for debugging
    await logWebhookEvent(event);
    
    // Process the event based on type
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event, subscriptionService);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, subscriptionService);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, subscriptionService);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event, subscriptionService);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event, subscriptionService, paymentRetryService);
        break;
        
      case 'invoice.payment_action_required':
        await handlePaymentActionRequired(event, subscriptionService);
        break;
        
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event, subscriptionService);
        break;
        
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event, subscriptionService);
        break;
        
      default:
        logger.info('Unhandled webhook event type', { 
          eventType: event.type,
          eventId: event.id 
        });
    }

    res.json({
      success: true,
      message: `Webhook event ${event.type} processed successfully`
    });

  } catch (error) {
    logger.error('Failed to process Stripe webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      signature: signature?.substring(0, 20) + '...'
    });

    res.status(400).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(event: Stripe.Event, subscriptionService: any) {
  const subscription = event.data.object as Stripe.Subscription;
  
  logger.info('Processing subscription.created webhook', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status
  });

  // Update subscription in database if needed
  // This might already be handled by the API endpoint, but webhook ensures consistency
  eventBus.publish({
    type: 'subscription.webhook.created',
    aggregateId: subscription.metadata?.shopId || 'unknown',
    timestamp: new Date(),
    source: 'StripeWebhook',
    version: 1,
    data: {
      subscriptionId: subscription.id,
      status: subscription.status,
      webhookEventId: event.id
    }
  });
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(event: Stripe.Event, subscriptionService: any) {
  const subscription = event.data.object as Stripe.Subscription;
  
  logger.info('Processing subscription.updated webhook', {
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  });

  // Update subscription status in database
  try {
    await updateSubscriptionInDatabase(subscription);
    
    eventBus.publish({
      type: 'subscription.webhook.updated',
      aggregateId: subscription.metadata?.shopId || 'unknown',
      timestamp: new Date(),
      source: 'StripeWebhook',
      version: 1,
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        webhookEventId: event.id
      }
    });
  } catch (error) {
    logger.error('Failed to update subscription in database', {
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(event: Stripe.Event, subscriptionService: any) {
  const subscription = event.data.object as Stripe.Subscription;
  
  logger.info('Processing subscription.deleted webhook', {
    subscriptionId: subscription.id,
    status: subscription.status
  });

  try {
    await updateSubscriptionInDatabase(subscription);
    
    eventBus.publish({
      type: 'subscription.webhook.deleted',
      aggregateId: subscription.metadata?.shopId || 'unknown',
      timestamp: new Date(),
      source: 'StripeWebhook',
      version: 1,
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        webhookEventId: event.id
      }
    });
  } catch (error) {
    logger.error('Failed to update subscription in database', {
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(event: Stripe.Event, subscriptionService: any) {
  const invoice = event.data.object as any; // Use any for expanded Stripe objects
  
  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  
  logger.info('Processing payment succeeded webhook', {
    invoiceId: invoice.id,
    subscriptionId,
    amountPaid: invoice.amount_paid
  });

  try {
    // Record successful payment attempt
    // await recordPaymentAttempt(invoice, 'succeeded');
    
    eventBus.publish({
      type: 'payment.webhook.succeeded',
      aggregateId: invoice.metadata?.shopId || 'unknown',
      timestamp: new Date(),
      source: 'StripeWebhook',
      version: 1,
      data: {
        invoiceId: invoice.id,
        subscriptionId: subscriptionId,
        amountPaid: invoice.amount_paid,
        webhookEventId: event.id
      }
    });
  } catch (error) {
    logger.error('Failed to record successful payment', {
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle failed payment with retry logic
 */
async function handlePaymentFailed(event: Stripe.Event, subscriptionService: any, paymentRetryService: any) {
  const invoice = event.data.object as any; // Use any for expanded Stripe objects
  
  logger.warn('Processing payment failed webhook', {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    attemptCount: invoice.attempt_count,
    nextPaymentAttempt: invoice.next_payment_attempt
  });

  try {
    // Get shop ID from subscription metadata
    const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (!subscriptionId) {
      logger.error('No subscription ID found in invoice', { invoiceId: invoice.id });
      return;
    }
    
    const shopId = await getShopIdFromSubscription(subscriptionId);
    
    if (!shopId) {
      logger.error('Could not find shop ID for subscription', {
        subscriptionId
      });
      return;
    }

    // Record failed payment attempt
    const attemptCount = invoice.attempt_count || 1;
    const maxRetries = 3;
    
    await paymentRetryService.recordPaymentAttempt({
      shopId,
      stripeSubscriptionId: subscriptionId,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id || '',
      attemptNumber: attemptCount,
      status: 'failed',
      failureCode: invoice.status,
      failureMessage: `Payment failed for invoice ${invoice.id}`,
      amountCents: invoice.amount_due,
      currency: invoice.currency?.toUpperCase() || 'USD',
      nextRetryAt: attemptCount < maxRetries ? calculateNextRetryTime(attemptCount) : undefined,
      metadata: {
        webhookEventId: event.id,
        originalInvoiceId: invoice.id
      }
    });
    
    if (attemptCount >= maxRetries) {
      logger.warn('Max payment retries reached', {
        invoiceId: invoice.id,
        finalAttemptCount: attemptCount,
        shopId
      });
    } else {
      logger.info('Payment failure recorded, retry scheduled', {
        invoiceId: invoice.id,
        attemptCount,
        nextRetryAt: calculateNextRetryTime(attemptCount).toISOString(),
        shopId
      });
    }
    
    eventBus.publish({
      type: 'payment.webhook.failed',
      aggregateId: shopId,
      timestamp: new Date(),
      source: 'StripeWebhook',
      version: 1,
      data: {
        invoiceId: invoice.id,
        subscriptionId,
        attemptCount,
        shopId,
        webhookEventId: event.id
      }
    });
  } catch (error) {
    logger.error('Failed to process payment failure', {
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle payment requiring action
 */
async function handlePaymentActionRequired(event: Stripe.Event, subscriptionService: any) {
  const invoice = event.data.object as any; // Use any for expanded Stripe objects
  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  
  logger.info('Processing payment action required webhook', {
    invoiceId: invoice.id,
    subscriptionId
  });

  try {
    await sendPaymentActionRequiredNotification(invoice);
    
    eventBus.publish({
      type: 'payment.webhook.action_required',
      aggregateId: invoice.metadata?.shopId || 'unknown',
      timestamp: new Date(),
      source: 'StripeWebhook',
      version: 1,
      data: {
        invoiceId: invoice.id,
        subscriptionId: subscriptionId,
        webhookEventId: event.id
      }
    });
  } catch (error) {
    logger.error('Failed to handle payment action required', {
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle trial ending soon
 */
async function handleTrialWillEnd(event: Stripe.Event, subscriptionService: any) {
  const subscription = event.data.object as Stripe.Subscription;
  
  logger.info('Processing trial will end webhook', {
    subscriptionId: subscription.id,
    trialEnd: subscription.trial_end
  });

  try {
    await sendTrialEndingNotification(subscription);
    
    eventBus.publish({
      type: 'trial.webhook.will_end',
      aggregateId: subscription.metadata?.shopId || 'unknown',
      timestamp: new Date(),
      source: 'StripeWebhook',
      version: 1,
      data: {
        subscriptionId: subscription.id,
        trialEnd: subscription.trial_end,
        webhookEventId: event.id
      }
    });
  } catch (error) {
    logger.error('Failed to handle trial will end', {
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Log webhook event to database
 */
async function logWebhookEvent(event: Stripe.Event) {
  try {
    const db = DatabaseService.getInstance();
    const query = `
      INSERT INTO stripe_subscription_events (
        shop_id, stripe_subscription_id, event_type, stripe_event_id, data
      ) VALUES ($1, $2, $3, $4, $5)
    `;
    
    // Extract shop ID from event data if possible
    let shopId = 'unknown';
    let subscriptionId = null;
    
    if (event.type.startsWith('customer.subscription')) {
      const subscription = event.data.object as Stripe.Subscription;
      subscriptionId = subscription.id;
      shopId = subscription.metadata?.shopId || 'unknown';
    } else if (event.type.startsWith('invoice')) {
      const invoice = event.data.object as any; // Use any for expanded objects
      subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null;
      if (subscriptionId) {
        shopId = await getShopIdFromSubscription(subscriptionId) || 'unknown';
      }
    }
    
    const values = [
      shopId,
      subscriptionId,
      event.type,
      event.id,
      JSON.stringify(event)
    ];
    
    await db.query(query, values);
    
    logger.info('Webhook event logged to database', {
      eventId: event.id,
      eventType: event.type,
      shopId,
      subscriptionId
    });
  } catch (error) {
    logger.error('Failed to log webhook event to database', {
      eventId: event.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Update subscription in database from webhook data
 */
async function updateSubscriptionInDatabase(subscription: Stripe.Subscription) {
  try {
    const db = DatabaseService.getInstance();
    const query = `
      UPDATE stripe_subscriptions 
      SET 
        status = $1,
        current_period_start = $2,
        current_period_end = $3,
        cancel_at_period_end = $4,
        canceled_at = $5,
        ended_at = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE stripe_subscription_id = $7
    `;
    
    const values = [
      subscription.status,
      new Date((subscription as any).current_period_start * 1000),
      new Date((subscription as any).current_period_end * 1000),
      subscription.cancel_at_period_end,
      subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
      subscription.id
    ];
    
    await db.query(query, values);
    
    logger.info('Subscription updated in database', {
      subscriptionId: subscription.id,
      status: subscription.status
    });
  } catch (error) {
    logger.error('Failed to update subscription in database', {
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Get shop ID from subscription ID
 */
async function getShopIdFromSubscription(subscriptionId: string): Promise<string | null> {
  try {
    const db = DatabaseService.getInstance();
    const query = `SELECT shop_id FROM stripe_subscriptions WHERE stripe_subscription_id = $1`;
    const result = await db.query(query, [subscriptionId]);
    
    return result.rows.length > 0 ? result.rows[0].shop_id : null;
  } catch (error) {
    logger.error('Failed to get shop ID from subscription', {
      subscriptionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Calculate next retry time with exponential backoff
 */
function calculateNextRetryTime(attemptNumber: number): Date {
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
 * Send payment action required notification
 */
async function sendPaymentActionRequiredNotification(invoice: Stripe.Invoice) {
  // Implementation would send notification requiring customer action
  // This is a placeholder - you'd implement the actual notification sending
  logger.info('Payment action required notification sent', {
    invoiceId: invoice.id
  });
}

/**
 * Send trial ending notification
 */
async function sendTrialEndingNotification(subscription: Stripe.Subscription) {
  // Implementation would send trial ending notification
  // This is a placeholder - you'd implement the actual notification sending
  logger.info('Trial ending notification sent', {
    subscriptionId: subscription.id,
    trialEnd: subscription.trial_end
  });
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event, subscriptionService: any) {
  const session = event.data.object as Stripe.Checkout.Session;
  
  logger.info('Processing checkout.session.completed webhook', {
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
    metadata: session.metadata,
    type: session.metadata?.type
  });

  try {
    const shopId = session.metadata?.shopId;
    if (!shopId) {
      logger.error('No shopId found in checkout session metadata', { sessionId: session.id });
      return;
    }

    // Check if this is an RCN purchase
    if (session.metadata?.type === 'rcn_purchase') {
      const purchaseId = session.metadata.purchaseId;
      const amount = parseInt(session.metadata.amount);
      
      logger.info('Processing RCN purchase completion', {
        shopId,
        purchaseId,
        amount,
        sessionId: session.id
      });

      // Complete the purchase
      await shopPurchaseService.completePurchase(purchaseId, session.id);
      
      // Publish event
      eventBus.publish({
        type: 'rcn.purchase.completed',
        aggregateId: shopId,
        timestamp: new Date(),
        source: 'StripeWebhook',
        version: 1,
        data: {
          shopId,
          purchaseId,
          amount,
          sessionId: session.id,
          webhookEventId: event.id
        }
      });
      
      logger.info('RCN purchase completed successfully', {
        shopId,
        purchaseId,
        amount
      });
      
      return; // Exit early for RCN purchases
    }

    // Original subscription logic
    if (session.subscription && typeof session.subscription === 'string') {
      // Get the full subscription details from Stripe
      const stripeService = getStripeService();
      const subscription = await stripeService.getSubscription(session.subscription);
      
      // Check if subscription already exists in our database
      const db = DatabaseService.getInstance();
      const existingQuery = `SELECT id FROM stripe_subscriptions WHERE stripe_subscription_id = $1`;
      const existingResult = await db.query(existingQuery, [subscription.id]);
      
      if (existingResult.rows.length > 0) {
        // Update existing subscription
        await updateSubscriptionInDatabase(subscription);
        logger.info('Updated existing subscription from webhook', {
          subscriptionId: subscription.id,
          shopId
        });
      } else {
        // Create new subscription record
        const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (!stripeCustomerId) {
          logger.error('No customer ID found in checkout session', { sessionId: session.id });
          return;
        }

        await subscriptionService.createSubscriptionRecord({
          shopId: shopId,
          stripeCustomerId: stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0]?.price.id || process.env.STRIPE_MONTHLY_PRICE_ID || '',
          status: subscription.status as any,
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          metadata: { 
            checkoutSessionId: session.id,
            webhookCreated: true 
          }
        });
        logger.info('Stripe webhook - subscription created and saved', {
          shopId: shopId,
          subscriptionId: subscription.id,
          status: subscription.status,
          stripeCustomerId: stripeCustomerId
        });
        logger.info('Created new subscription record from webhook', {
          subscriptionId: subscription.id,
          shopId
        });
      }
      
      // Emit success event
      eventBus.publish({
        type: 'checkout.webhook.completed',
        aggregateId: shopId,
        timestamp: new Date(),
        source: 'StripeWebhook',
        version: 1,
        data: {
          sessionId: session.id,
          subscriptionId: session.subscription,
          customerId: session.customer,
          shopId,
          webhookEventId: event.id
        }
      });
      
      logger.info('Checkout session completed successfully', {
        sessionId: session.id,
        subscriptionId: session.subscription,
        shopId
      });
    }
  } catch (error) {
    logger.error('Failed to handle checkout session completed', {
      sessionId: session.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default router;