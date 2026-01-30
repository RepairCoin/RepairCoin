import { Router, Request, Response } from 'express';
import { getStripeService } from '../../../services/StripeService';
import { getSubscriptionService } from '../../../services/SubscriptionService';
import { getPaymentRetryService } from '../../../services/PaymentRetryService';
import { PaymentService } from '../../ServiceDomain/services/PaymentService';
import { logger } from '../../../utils/logger';
import { eventBus } from '../../../events/EventBus';
import { DatabaseService } from '../../../services/DatabaseService';
import { shopPurchaseService } from '../services/ShopPurchaseService';
import { ShopSubscriptionRepository } from '../../../repositories/ShopSubscriptionRepository';
import { NotificationService } from '../../notification/services/NotificationService';
import Stripe from 'stripe';

const router = Router();

/**
 * Helper function to extract period dates from Stripe subscription.
 * In newer Stripe API versions, current_period_start/end may be in items.data[0]
 * instead of directly on the subscription object.
 */
function extractSubscriptionPeriodDates(subscription: Stripe.Subscription): {
  currentPeriodStart: number | undefined;
  currentPeriodEnd: number | undefined;
} {
  let currentPeriodStart = (subscription as any).current_period_start;
  let currentPeriodEnd = (subscription as any).current_period_end;

  // If not on subscription directly, check items.data[0] (newer Stripe API)
  if (!currentPeriodStart || !currentPeriodEnd) {
    const firstItem = subscription.items?.data?.[0];
    if (firstItem) {
      currentPeriodStart = currentPeriodStart || (firstItem as any).current_period_start;
      currentPeriodEnd = currentPeriodEnd || (firstItem as any).current_period_end;
    }
  }

  return { currentPeriodStart, currentPeriodEnd };
}

/**
 * Handle successful service payment
 */
async function handleServicePaymentSuccess(event: Stripe.Event, paymentService: PaymentService) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  logger.info('Processing payment_intent.succeeded webhook', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    status: paymentIntent.status,
    type: paymentIntent.metadata?.type
  });

  try {
    // Check if this is a service booking payment by looking at metadata
    if (paymentIntent.metadata?.type === 'service_booking') {
      await paymentService.handlePaymentSuccess(paymentIntent.id);

      logger.info('Service payment processed successfully', {
        paymentIntentId: paymentIntent.id,
        orderId: paymentIntent.metadata?.orderId
      });
    } else if (paymentIntent.metadata?.type === 'subscription_payment') {
      // Handle mobile subscription payment
      await handleMobileSubscriptionPaymentSuccess(paymentIntent);
    } else if (paymentIntent.metadata?.type === 'rcn_purchase') {
      // Handle mobile RCN token purchase
      await handleMobileRcnPurchaseSuccess(paymentIntent);
    } else {
      logger.info('Payment intent is not for service booking, subscription, or RCN purchase, skipping', {
        paymentIntentId: paymentIntent.id,
        type: paymentIntent.metadata?.type
      });
    }
  } catch (error) {
    logger.error('Failed to process payment success', {
      paymentIntentId: paymentIntent.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle mobile RCN token purchase success
 * This is called when a PaymentIntent with type='rcn_purchase' succeeds
 */
async function handleMobileRcnPurchaseSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { shopId, purchaseId, amount } = paymentIntent.metadata;

  logger.info('Processing mobile RCN purchase payment success', {
    paymentIntentId: paymentIntent.id,
    shopId,
    purchaseId,
    amount
  });

  try {
    // Complete the purchase - this credits the RCN tokens to the shop
    await shopPurchaseService.completePurchase(purchaseId, paymentIntent.id);

    logger.info('RCN purchase completed successfully via mobile payment', {
      shopId,
      purchaseId,
      amount,
      paymentIntentId: paymentIntent.id
    });

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
        amount: parseInt(amount),
        paymentIntentId: paymentIntent.id,
        platform: 'mobile'
      }
    });

    // Send notification to shop
    try {
      const db = DatabaseService.getInstance();
      const shopQuery = await db.query(
        'SELECT wallet_address FROM shops WHERE shop_id = $1',
        [shopId]
      );

      if (shopQuery.rows.length > 0 && shopQuery.rows[0].wallet_address) {
        const notificationService = new NotificationService();
        await notificationService.createNotification({
          senderAddress: 'SYSTEM',
          receiverAddress: shopQuery.rows[0].wallet_address,
          notificationType: 'rcn_purchase_completed',
          message: `Your purchase of ${amount} RCN tokens has been completed successfully.`,
          metadata: {
            purchaseId,
            amount: parseInt(amount),
            paymentIntentId: paymentIntent.id
          }
        });
        logger.info('RCN purchase notification sent', { shopId, purchaseId });
      }
    } catch (notifError) {
      logger.error('Failed to send RCN purchase notification:', notifError);
    }

  } catch (error) {
    logger.error('Failed to process mobile RCN purchase payment', {
      paymentIntentId: paymentIntent.id,
      shopId,
      purchaseId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Handle mobile subscription payment success
 * This is called when a PaymentIntent with type='subscription_payment' succeeds
 */
async function handleMobileSubscriptionPaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { shopId, subscriptionId, invoiceId } = paymentIntent.metadata;

  logger.info('Processing mobile subscription payment success', {
    paymentIntentId: paymentIntent.id,
    shopId,
    subscriptionId,
    invoiceId
  });

  try {
    const stripeService = getStripeService();
    const stripe = stripeService.getStripe();
    const subscriptionService = getSubscriptionService();

    // 1. Attach the payment method to the customer for future payments
    const paymentMethodId = paymentIntent.payment_method as string;
    const customerId = paymentIntent.customer as string;

    if (paymentMethodId && customerId) {
      // Set as default payment method for customer
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      logger.info('Payment method set as default for customer', {
        customerId,
        paymentMethodId
      });
    }

    // 2. Pay the invoice to activate the subscription
    if (invoiceId) {
      try {
        const invoice = await stripe.invoices.pay(invoiceId, {
          payment_method: paymentMethodId
        });

        logger.info('Invoice paid successfully', {
          invoiceId,
          invoiceStatus: invoice.status
        });
      } catch (invoiceError: any) {
        // Invoice might already be paid or subscription might auto-activate
        logger.warn('Could not pay invoice directly, checking subscription status', {
          invoiceId,
          error: invoiceError.message
        });
      }
    }

    // 3. Retrieve and update subscription status
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      logger.info('Subscription status after payment', {
        subscriptionId,
        status: subscription.status
      });

      // Update subscription in database
      const db = DatabaseService.getInstance();

      // Update stripe_subscriptions table
      await db.query(
        `UPDATE stripe_subscriptions
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = $2`,
        [subscription.status, subscriptionId]
      );

      // If subscription is now active, create/update shop_subscriptions record
      if (subscription.status === 'active') {
        const shopSubRepo = new ShopSubscriptionRepository();
        const { currentPeriodEnd: periodEndTimestamp } = extractSubscriptionPeriodDates(subscription);
        const currentPeriodEnd = periodEndTimestamp
          ? new Date(periodEndTimestamp * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Fallback to 30 days

        // Check if shop_subscriptions record exists
        const existingShopSub = await db.query(
          'SELECT id FROM shop_subscriptions WHERE shop_id = $1',
          [shopId]
        );

        if (existingShopSub.rows.length > 0) {
          // Update existing record
          await db.query(
            `UPDATE shop_subscriptions
             SET status = 'active',
                 is_active = true,
                 billing_reference = $1,
                 next_payment_date = $2,
                 last_payment_date = CURRENT_TIMESTAMP,
                 activated_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE shop_id = $3`,
            [subscriptionId, currentPeriodEnd, shopId]
          );
        } else {
          // Create new record
          await shopSubRepo.createSubscription({
            shopId: shopId,
            status: 'active',
            monthlyAmount: 500,
            subscriptionType: 'standard',
            billingMethod: 'credit_card',
            billingReference: subscriptionId,
            paymentsMade: 1,
            totalPaid: 500,
            nextPaymentDate: currentPeriodEnd,
            lastPaymentDate: new Date(),
            activatedAt: new Date(),
            createdBy: `Mobile App Payment - ${paymentIntent.id}`,
            notes: `Created via mobile app payment | PaymentIntent: ${paymentIntent.id}`
          });
        }

        // Update shop operational status
        await db.query(
          `UPDATE shops
           SET operational_status = 'subscription_qualified',
               updated_at = CURRENT_TIMESTAMP
           WHERE shop_id = $1`,
          [shopId]
        );

        logger.info('Shop subscription activated via mobile payment', {
          shopId,
          subscriptionId,
          paymentIntentId: paymentIntent.id
        });

        // Send notification
        try {
          const shopQuery = await db.query(
            'SELECT wallet_address FROM shops WHERE shop_id = $1',
            [shopId]
          );

          if (shopQuery.rows.length > 0 && shopQuery.rows[0].wallet_address) {
            const notificationService = new NotificationService();
            await notificationService.createSubscriptionApprovedNotification(
              shopQuery.rows[0].wallet_address
            );
            logger.info('Subscription approval notification sent', { shopId, subscriptionId });
          }
        } catch (notifError) {
          logger.error('Failed to send subscription approval notification:', notifError);
        }
      }
    }

    // Publish event
    eventBus.publish({
      type: 'subscription.mobile_payment.succeeded',
      aggregateId: shopId,
      timestamp: new Date(),
      source: 'StripeWebhook',
      version: 1,
      data: {
        shopId,
        subscriptionId,
        invoiceId,
        paymentIntentId: paymentIntent.id
      }
    });

  } catch (error) {
    logger.error('Failed to process mobile subscription payment', {
      paymentIntentId: paymentIntent.id,
      shopId,
      subscriptionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Handle failed service payment
 */
async function handleServicePaymentFailed(event: Stripe.Event, paymentService: PaymentService) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  logger.warn('Processing service payment failed webhook', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    status: paymentIntent.status
  });

  try {
    // Check if this is a service booking payment
    if (paymentIntent.metadata?.type === 'service_booking') {
      const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
      await paymentService.handlePaymentFailure(paymentIntent.id, failureMessage);

      logger.info('Service payment failure processed', {
        paymentIntentId: paymentIntent.id,
        orderId: paymentIntent.metadata?.orderId,
        reason: failureMessage
      });
    }
  } catch (error) {
    logger.error('Failed to process service payment failure', {
      paymentIntentId: paymentIntent.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle canceled service payment
 */
async function handleServicePaymentCanceled(event: Stripe.Event, paymentService: PaymentService) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  logger.info('Processing service payment canceled webhook', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    status: paymentIntent.status
  });

  try {
    // Check if this is a service booking payment
    if (paymentIntent.metadata?.type === 'service_booking') {
      await paymentService.handlePaymentFailure(paymentIntent.id, 'Payment canceled by user or system');

      logger.info('Service payment cancellation processed', {
        paymentIntentId: paymentIntent.id,
        orderId: paymentIntent.metadata?.orderId
      });
    }
  } catch (error) {
    logger.error('Failed to process service payment cancellation', {
      paymentIntentId: paymentIntent.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

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
    const paymentService = new PaymentService(stripeService);

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

      case 'payment_intent.succeeded':
        await handleServicePaymentSuccess(event, paymentService);
        break;

      case 'payment_intent.payment_failed':
        await handleServicePaymentFailed(event, paymentService);
        break;

      case 'payment_intent.canceled':
        await handleServicePaymentCanceled(event, paymentService);
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

    // IMPORTANT: Sync subscription dates after successful payment (renewal)
    // This ensures shop_subscriptions.next_payment_date stays in sync with Stripe
    if (subscriptionId) {
      try {
        const stripeService = getStripeService();
        const stripe = stripeService.getStripe();

        // Fetch the latest subscription data from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        const { currentPeriodEnd: periodEndTs } = extractSubscriptionPeriodDates(subscription);
        logger.info('Fetched subscription from Stripe for date sync', {
          subscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: periodEndTs ? new Date(periodEndTs * 1000).toISOString() : 'undefined'
        });

        // Update subscription in database (this will also sync next_payment_date)
        await updateSubscriptionInDatabase(subscription);

        logger.info('Successfully synced subscription dates after payment', {
          subscriptionId: subscription.id
        });
      } catch (syncError) {
        // Log error but don't fail the webhook - payment was still successful
        logger.error('Failed to sync subscription dates after payment', {
          subscriptionId,
          error: syncError instanceof Error ? syncError.message : 'Unknown error'
        });
      }
    }
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

    // Extract period dates - check items.data[0] if not directly on subscription (newer Stripe API)
    let currentPeriodStart = (subscription as any).current_period_start;
    let currentPeriodEnd = (subscription as any).current_period_end;

    if (!currentPeriodStart || !currentPeriodEnd) {
      const firstItem = subscription.items?.data?.[0];
      if (firstItem) {
        currentPeriodStart = currentPeriodStart || (firstItem as any).current_period_start;
        currentPeriodEnd = currentPeriodEnd || (firstItem as any).current_period_end;
      }
    }

    logger.info('Updating subscription in database', {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodStart,
      currentPeriodEnd,
      sourceLocation: (subscription as any).current_period_end ? 'subscription' : 'items.data[0]'
    });

    // Update stripe_subscriptions table
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
      RETURNING shop_id
    `;

    const values = [
      subscription.status,
      currentPeriodStart ? new Date(currentPeriodStart * 1000) : new Date(),
      currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subscription.cancel_at_period_end,
      subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
      subscription.id
    ];

    const result = await db.query(query, values);

    // Update shop operational_status based on subscription status
    if (result.rows.length > 0) {
      const shopId = result.rows[0].shop_id;
      const activeStatuses = ['active', 'past_due', 'unpaid'];
      const isActive = activeStatuses.includes(subscription.status);

      // Get shop's RCG balance to determine operational status
      const shopQuery = `SELECT rcg_balance FROM shops WHERE shop_id = $1`;
      const shopResult = await db.query(shopQuery, [shopId]);

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

        // Don't override 'paused' status (admin manually paused)
        const currentStatusCheck = await db.query(
          'SELECT operational_status FROM shops WHERE shop_id = $1', [shopId]
        );
        const currentOpStatus = currentStatusCheck.rows[0]?.operational_status;

        if (currentOpStatus !== 'paused') {
          const updateShopQuery = `
            UPDATE shops
            SET operational_status = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE shop_id = $2
          `;
          await db.query(updateShopQuery, [operationalStatus, shopId]);
        }

        logger.info('Shop operational status update from subscription change', {
          shopId,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          operationalStatus,
          rcgBalance
        });
      }

      // Sync shop_subscriptions.next_payment_date with stripe's current_period_end
      const { currentPeriodEnd: periodEndTs } = extractSubscriptionPeriodDates(subscription);
      if (periodEndTs) {
        const shopSubRepo = new ShopSubscriptionRepository();
        await shopSubRepo.syncNextPaymentDateFromStripe(
          shopId,
          new Date(periodEndTs * 1000)
        );
      }
    }

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

        const { currentPeriodStart: periodStartTs, currentPeriodEnd: periodEndTs } = extractSubscriptionPeriodDates(subscription);
        const periodStartDate = periodStartTs ? new Date(periodStartTs * 1000) : new Date();
        const periodEndDate = periodEndTs ? new Date(periodEndTs * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await subscriptionService.createSubscriptionRecord({
          shopId: shopId,
          stripeCustomerId: stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0]?.price.id || process.env.STRIPE_MONTHLY_PRICE_ID || '',
          status: subscription.status as any,
          currentPeriodStart: periodStartDate,
          currentPeriodEnd: periodEndDate,
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

        // Also create shop_subscriptions record for admin panel visibility
        try {
          const shopSubRepo = new ShopSubscriptionRepository();
          const currentPeriodEnd = periodEndDate;

          await shopSubRepo.createSubscription({
            shopId: shopId,
            status: 'active',
            monthlyAmount: 500,
            subscriptionType: 'standard',
            billingMethod: 'credit_card',
            billingReference: subscription.id,
            paymentsMade: 1,
            totalPaid: 500,
            nextPaymentDate: currentPeriodEnd,
            lastPaymentDate: new Date(),
            activatedAt: new Date(),
            createdBy: `Stripe Webhook - ${session.id}`,
            notes: `Created via Stripe webhook on checkout.session.completed | Stripe Sub ID: ${subscription.id} | Customer ID: ${stripeCustomerId}`
          });

          logger.info('Shop subscription record created from webhook', {
            shopId,
            subscriptionId: subscription.id,
            billingReference: subscription.id
          });

          // Send notification to shop about subscription approval
          try {
            const db = DatabaseService.getInstance();
            const shopQuery = await db.query(
              'SELECT wallet_address FROM shops WHERE shop_id = $1',
              [shopId]
            );

            if (shopQuery.rows.length > 0 && shopQuery.rows[0].wallet_address) {
              const notificationService = new NotificationService();
              await notificationService.createSubscriptionApprovedNotification(
                shopQuery.rows[0].wallet_address
              );
              logger.info('Subscription approval notification sent', { shopId, subscriptionId: subscription.id });
            }
          } catch (notifError) {
            logger.error('Failed to send subscription approval notification:', notifError);
          }
        } catch (shopSubError) {
          logger.error('Failed to create shop_subscriptions record', {
            shopId,
            subscriptionId: subscription.id,
            error: shopSubError instanceof Error ? shopSubError.message : 'Unknown error'
          });
          // Don't throw - stripe_subscriptions was created successfully
        }

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