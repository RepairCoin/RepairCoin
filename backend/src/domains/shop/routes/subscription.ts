import { Router, Request, Response } from 'express';
import { getSubscriptionService } from '../../../services/SubscriptionService';
import { getStripeService } from '../../../services/StripeService';
import { logger } from '../../../utils/logger';
import { authMiddleware } from '../../../middleware/auth';
import { DatabaseService } from '../../../services/DatabaseService';
import { shopRepository } from '../../../repositories';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Create a separate router for public endpoints
const publicRouter = Router();


/**
 * @swagger
 * /api/shops/subscription/status:
 *   get:
 *     summary: Get shop's subscription status (commitment program)
 *     tags: [Shop Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentSubscription:
 *                       type: object
 *                     hasActiveSubscription:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get('/subscription/status', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    
    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    logger.info('🔍 SUBSCRIPTION STATUS - Checking for shop:', {
      shopId,
      user: req.user
    });

    // Check for Stripe subscription only (commitment enrollment system removed)
    const subscriptionService = getSubscriptionService();
    const stripeSubscription = await subscriptionService.getActiveSubscription(shopId);
    
    if (stripeSubscription) {
      // Log subscription found
      logger.info('✅ BACKEND - SUBSCRIPTION STATUS: TRUE - Active subscription found for shop:', {
        shopId,
        subscriptionId: stripeSubscription.stripeSubscriptionId,
        status: stripeSubscription.status,
        stripePriceId: stripeSubscription.stripePriceId,
        currentPeriodEnd: stripeSubscription.currentPeriodEnd
      });

      // Calculate payments made (months since creation)
      const createdDate = new Date(stripeSubscription.createdAt);
      const now = new Date();
      const monthsDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      const paymentsMade = Math.max(1, monthsDiff); // At least 1 if subscription is active
      const monthlyAmount = stripeSubscription.stripePriceId === process.env.STRIPE_MONTHLY_PRICE_ID ? 500 : 0;
      
      // Return Stripe subscription data
      res.json({
        success: true,
        data: {
          currentSubscription: {
            id: stripeSubscription.id,
            status: stripeSubscription.status,
            monthlyAmount: monthlyAmount,
            subscriptionType: 'stripe_subscription',
            billingMethod: 'credit_card',
            nextPaymentDate: new Date(stripeSubscription.currentPeriodEnd).toISOString(),
            lastPaymentDate: null, // Stripe subscriptions don't track lastPaymentDate in our current schema
            enrolledAt: stripeSubscription.createdAt,
            cancelAtPeriodEnd: stripeSubscription.cancelAtPeriodEnd || false,
            currentPeriodEnd: stripeSubscription.currentPeriodEnd ? new Date(stripeSubscription.currentPeriodEnd).toISOString() : null,
            paymentsMade: paymentsMade,
            totalPaid: paymentsMade * monthlyAmount
          },
          hasActiveSubscription: true
        }
      });
    } else {
      logger.info('❌ BACKEND - SUBSCRIPTION STATUS: FALSE - No active subscription found for shop:', { shopId });
      res.json({
        success: true,
        data: {
          currentSubscription: null,
          hasActiveSubscription: false
        }
      });
    }

  } catch (error) {
    logger.error('Failed to get subscription status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      shopId: req.user?.shopId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription status'
    });
  }
});

/**
 * @swagger
 * /api/shops/subscription/sync:
 *   post:
 *     summary: Sync subscription status from Stripe
 *     tags: [Shop Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription synced successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/subscription/sync', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    
    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    logger.info('Starting subscription sync for shop', { shopId });

    const subscriptionService = getSubscriptionService();
    
    // Get customer
    const customer = await subscriptionService.getCustomerByShopId(shopId);
    if (!customer) {
      logger.info('No Stripe customer found for shop', { shopId });
      return res.json({
        success: true,
        message: 'No Stripe customer found for this shop',
        data: { synced: false }
      });
    }

    logger.info('Found Stripe customer', { 
      shopId, 
      stripeCustomerId: customer.stripeCustomerId 
    });

    // Get all subscriptions from Stripe for this customer
    logger.info('Fetching subscriptions from Stripe', { 
      customerId: customer.stripeCustomerId 
    });
    
    let subscriptions;
    try {
      // Get stripeService instance
      const stripeService = getStripeService();
      const stripe = stripeService.getStripe();
      
      // First try to get all subscriptions (not just active)
      subscriptions = await stripe.subscriptions.list({
        customer: customer.stripeCustomerId,
        limit: 10
      });
      
      logger.info('Fetched subscriptions from Stripe', {
        customerId: customer.stripeCustomerId,
        totalCount: subscriptions.data.length,
        subscriptions: subscriptions.data.map(sub => ({
          id: sub.id,
          status: sub.status,
          created: new Date(sub.created * 1000).toISOString()
        }))
      });
    } catch (stripeError) {
      logger.error('Stripe API error when fetching subscriptions', {
        error: stripeError instanceof Error ? stripeError.message : 'Unknown error',
        customerId: customer.stripeCustomerId
      });
      throw new Error('Failed to fetch subscriptions from Stripe: ' + (stripeError instanceof Error ? stripeError.message : 'Unknown error'));
    }

    // Filter for active subscriptions
    const activeSubscriptions = subscriptions.data.filter(sub => sub.status === 'active');
    
    if (activeSubscriptions.length === 0) {
      logger.info('No active subscriptions found in Stripe', {
        customerId: customer.stripeCustomerId,
        allSubscriptionStatuses: subscriptions.data.map(s => s.status)
      });
      return res.json({
        success: true,
        message: `No active subscriptions found in Stripe. Found ${subscriptions.data.length} subscription(s) with statuses: ${subscriptions.data.map(s => s.status).join(', ')}`,
        data: { synced: false }
      });
    }

    // Take the first active subscription
    const activeSubscription = activeSubscriptions[0];
    
    // Check if we have this subscription in our database
    const db = DatabaseService.getInstance();
    const existingQuery = `SELECT id FROM stripe_subscriptions WHERE stripe_subscription_id = $1`;
    const existingResult = await db.query(existingQuery, [activeSubscription.id]);
    
    if (existingResult.rows.length === 0) {
      // Create the subscription record
      const currentPeriodStart = activeSubscription.current_period_start 
        ? new Date(activeSubscription.current_period_start * 1000) 
        : new Date();
      const currentPeriodEnd = activeSubscription.current_period_end 
        ? new Date(activeSubscription.current_period_end * 1000) 
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      
      await subscriptionService.createSubscriptionRecord({
        shopId: shopId,
        stripeCustomerId: customer.stripeCustomerId,
        stripeSubscriptionId: activeSubscription.id,
        stripePriceId: activeSubscription.items.data[0]?.price.id || '',
        status: activeSubscription.status as any,
        currentPeriodStart: currentPeriodStart,
        currentPeriodEnd: currentPeriodEnd,
        metadata: { syncedManually: true }
      });

      logger.info('Manually synced subscription from Stripe', {
        shopId,
        subscriptionId: activeSubscription.id,
        status: activeSubscription.status
      });

      res.json({
        success: true,
        message: 'Subscription synced successfully',
        data: { 
          synced: true,
          subscriptionId: activeSubscription.id,
          status: activeSubscription.status
        }
      });
    } else {
      res.json({
        success: true,
        message: 'Subscription already exists in database',
        data: { 
          synced: false,
          subscriptionId: activeSubscription.id,
          status: activeSubscription.status
        }
      });
    }

  } catch (error) {
    logger.error('Failed to sync subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
      shopId: req.user?.shopId,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return more specific error messages
    if (error instanceof Error && error.message.includes('STRIPE_SECRET_KEY')) {
      res.status(503).json({
        success: false,
        error: 'Payment service temporarily unavailable'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync subscription'
      });
    }
  }
});

/**
 * @swagger
 * /api/shops/subscription/subscribe:
 *   post:
 *     summary: Subscribe to commitment program
 *     tags: [Shop Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               billingMethod:
 *                 type: string
 *                 enum: [credit_card, ach, wire]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription created
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/subscription/subscribe', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { billingMethod, notes, billingEmail, billingContact, billingPhone } = req.body;
    
    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    // Validate required fields
    if (!billingMethod || !billingEmail || !billingContact) {
      return res.status(400).json({
        success: false,
        error: 'Billing method, email, and contact name are required'
      });
    }

    // Check if shop already has an active Stripe subscription
    const subscriptionService = getSubscriptionService();
    const existingSubscription = await subscriptionService.getActiveSubscription(shopId);
    
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'Shop already has an active subscription'
      });
    }

    // Note: commitment_enrollments table has been removed as of September 2025
    // No cleanup needed as system now uses stripe_subscriptions table exclusively

    // Only support credit card payments now - ACH/wire transfers removed
    if (billingMethod !== 'credit_card') {
      return res.status(400).json({
        success: false,
        error: 'Only credit card payments are supported. Please select credit card as your payment method.'
      });
    }

    // Use Stripe for credit card payments
    try {
      const stripeService = getStripeService();
      const subscriptionService = getSubscriptionService();
      
      // Get shop details
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      // Create or get Stripe customer
      let stripeCustomer = await subscriptionService.getCustomerByShopId(shopId);
      
      if (!stripeCustomer) {
        // Create new Stripe customer
        const customer = await stripeService.createCustomer({
          email: billingEmail,
          name: billingContact,
          shopId: shopId
        });
        
        // Save to database
        await DatabaseService.getInstance().getPool().query(
          `INSERT INTO stripe_customers (shop_id, stripe_customer_id, email, name) 
           VALUES ($1, $2, $3, $4)`,
          [shopId, customer.id, billingEmail, billingContact]
        );
        
        stripeCustomer = {
          id: 0, // Will be set by database
          stripeCustomerId: customer.id,
          shopId,
          email: billingEmail,
          name: billingContact,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

      // Create Stripe checkout session
      const stripe = stripeService.getStripe();
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomer.stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [{
          price: process.env.STRIPE_MONTHLY_PRICE_ID,
          quantity: 1
        }],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/shop/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/shop?tab=subscription`,
        metadata: {
          shopId: shopId,
          environment: process.env.NODE_ENV || 'development'
        }
      });

      // Save the pending subscription to database so we can track it
      // Note: session.subscription may be null for checkout sessions, but webhook will handle creation
      if (session.subscription) {
        await subscriptionService.createSubscriptionRecord({
          shopId: shopId,
          stripeCustomerId: stripeCustomer.stripeCustomerId,
          stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
          stripePriceId: process.env.STRIPE_MONTHLY_PRICE_ID || '',
          status: 'incomplete', // Will be updated by webhook when payment succeeds
          metadata: { checkoutSessionId: session.id }
        });
      }

      logger.info('Stripe checkout session created', {
        shopId,
        sessionId: session.id,
        customerId: stripeCustomer.stripeCustomerId
      });

      res.json({
        success: true,
        data: {
          message: 'Redirecting to secure payment...',
          paymentUrl: session.url,
          sessionId: session.id,
          billingMethod: 'credit_card',
          nextSteps: 'You will be redirected to Stripe to complete payment setup.'
        }
      });

    } catch (stripeError) {
      logger.error('Stripe subscription creation failed', {
        error: stripeError instanceof Error ? stripeError.message : 'Unknown error',
        shopId,
        stack: stripeError instanceof Error ? stripeError.stack : undefined
      });
      
      // Check for specific Stripe configuration errors
      if (stripeError instanceof Error) {
        if (stripeError.message.includes('STRIPE_SECRET_KEY') || 
            stripeError.message.includes('STRIPE_WEBHOOK_SECRET') || 
            stripeError.message.includes('STRIPE_MONTHLY_PRICE_ID')) {
          return res.status(503).json({
            success: false,
            error: 'Payment service is not properly configured. Please contact support.',
            details: process.env.NODE_ENV === 'development' ? stripeError.message : undefined
          });
        }
      }
      
      return res.status(500).json({
        success: false,
        error: 'Payment processing is temporarily unavailable. Please try again later.'
      });
    }

  } catch (error) {
    logger.error('Failed to create subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
      shopId: req.user?.shopId
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subscription'
    });
  }
});

/**
 * @swagger
 * /api/shops/subscription/cancel:
 *   post:
 *     summary: Cancel shop subscription
 *     tags: [Shop Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *       404:
 *         description: No active subscription found
 *       401:
 *         description: Unauthorized
 */
router.post('/subscription/cancel', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { reason } = req.body;
    
    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    const subscriptionService = getSubscriptionService();
    
    // Check for active Stripe subscription
    const activeSubscription = await subscriptionService.getActiveSubscription(shopId);
    
    if (!activeSubscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Cancel the subscription at period end (graceful cancellation) with user's reason
    const updatedSubscription = await subscriptionService.cancelSubscription(shopId, false, reason);

    logger.info('Subscription cancelled', {
      shopId,
      subscriptionId: activeSubscription.stripeSubscriptionId,
      reason
    });

    res.json({
      success: true,
      data: {
        message: 'Subscription cancelled successfully. Your subscription will remain active until the end of the current billing period.',
        subscription: updatedSubscription
      }
    });

  } catch (error) {
    logger.error('Failed to cancel subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
      shopId: req.user?.shopId
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription'
    });
  }
});

/**
 * @swagger
 * /api/shops/subscription/reactivate:
 *   post:
 *     summary: Reactivate a cancelled subscription
 *     tags: [Shop Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription reactivated successfully
 *       404:
 *         description: No subscription found
 *       400:
 *         description: Subscription is not cancelled
 *       401:
 *         description: Unauthorized
 */
router.post('/subscription/reactivate', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    
    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    const subscriptionService = getSubscriptionService();
    
    // Get active subscription (including ones pending cancellation)
    const activeSubscription = await subscriptionService.getActiveSubscription(shopId);
    
    if (!activeSubscription) {
      return res.status(404).json({
        success: false,
        error: 'No subscription found'
      });
    }

    if (!activeSubscription.cancelAtPeriodEnd) {
      return res.status(400).json({
        success: false,
        error: 'Subscription is not pending cancellation'
      });
    }

    // Reactivate the subscription in Stripe
    const stripeService = getStripeService();
    const stripe = stripeService.getStripe();
    
    const updatedStripeSubscription = await stripe.subscriptions.update(
      activeSubscription.stripeSubscriptionId,
      {
        cancel_at_period_end: false
      }
    );

    // Update both subscription tables in database
    const db = DatabaseService.getInstance();
    const pool = db.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update stripe_subscriptions table
      const updateStripeQuery = `
        UPDATE stripe_subscriptions
        SET
          cancel_at_period_end = false,
          canceled_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE stripe_subscription_id = $1
        RETURNING *
      `;

      const updateResult = await client.query(updateStripeQuery, [activeSubscription.stripeSubscriptionId]);

      // Also reactivate shop_subscriptions table
      const updateShopSubQuery = `
        UPDATE shop_subscriptions
        SET
          status = 'active',
          is_active = true,
          cancelled_at = NULL,
          cancellation_reason = NULL,
          resumed_at = CURRENT_TIMESTAMP
        WHERE shop_id = $1 AND status = 'cancelled'
      `;

      await client.query(updateShopSubQuery, [shopId]);

      await client.query('COMMIT');

      logger.info('Subscription reactivated in both tables', {
        shopId,
        subscriptionId: activeSubscription.stripeSubscriptionId
      });

      res.json({
        success: true,
        data: {
          message: 'Subscription reactivated successfully! Your subscription will continue as normal.',
          subscription: updateResult.rows[0]
        }
      });

      client.release();
    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      throw error;
    }

    return;

  } catch (error) {
    logger.error('Failed to reactivate subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
      shopId: req.user?.shopId
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reactivate subscription'
    });
    return;
  }
});

/**
 * @swagger
 * /api/shops/{shopId}/subscription:
 *   post:
 *     summary: Create a new Stripe subscription for monthly billing
 *     tags: [Shop Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shop ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Customer email for billing
 *               name:
 *                 type: string
 *                 description: Customer name
 *               paymentMethodId:
 *                 type: string
 *                 description: Stripe payment method ID (optional for setup intent flow)
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *                     clientSecret:
 *                       type: string
 *                       description: Client secret for payment confirmation (if required)
 *       400:
 *         description: Bad request or shop already has subscription
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/:shopId/subscription', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const { email, name, paymentMethodId } = req.body;

    // Validate shop ownership
    if (req.user?.role !== 'admin' && req.user?.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'You can only manage your own subscription'
      });
    }

    // Validate required fields
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email and name are required'
      });
    }

    const subscriptionService = getSubscriptionService();
    const result = await subscriptionService.createSubscription(
      shopId, 
      email, 
      name, 
      paymentMethodId
    );

    logger.info('Subscription created via API', {
      shopId,
      subscriptionId: result.subscription.stripeSubscriptionId,
      hasClientSecret: !!result.clientSecret
    });

    res.status(201).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Failed to create subscription via API', {
      shopId: req.params.shopId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    const statusCode = error instanceof Error && error.message.includes('already has') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subscription'
    });
  }
});

/**
 * @swagger
 * /api/shops/{shopId}/subscription:
 *   get:
 *     summary: Get current subscription status
 *     tags: [Shop Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shop ID
 *     responses:
 *       200:
 *         description: Subscription details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *                     customer:
 *                       $ref: '#/components/schemas/Customer'
 *       404:
 *         description: No active subscription found
 *       401:
 *         description: Unauthorized
 */
router.get('/:shopId/subscription', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;

    // Validate shop ownership
    if (req.user?.role !== 'admin' && req.user?.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own subscription'
      });
    }

    const subscriptionService = getSubscriptionService();
    const [subscription, customer] = await Promise.all([
      subscriptionService.getActiveSubscription(shopId),
      subscriptionService.getCustomerByShopId(shopId)
    ]);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    res.json({
      success: true,
      data: {
        subscription,
        customer
      }
    });

  } catch (error) {
    logger.error('Failed to get subscription via API', {
      shopId: req.params.shopId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription'
    });
  }
});

/**
 * @swagger
 * /api/shops/{shopId}/subscription/setup-intent:
 *   post:
 *     summary: Create setup intent for saving payment method
 *     tags: [Shop Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shop ID
 *     responses:
 *       200:
 *         description: Setup intent created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientSecret:
 *                       type: string
 *                       description: Setup intent client secret
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:shopId/subscription/setup-intent', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;

    // Validate shop ownership
    if (req.user?.role !== 'admin' && req.user?.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'You can only manage your own payment methods'
      });
    }

    const subscriptionService = getSubscriptionService();
    const customer = await subscriptionService.getCustomerByShopId(shopId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found. Please create a subscription first.'
      });
    }

    const stripeService = getStripeService();
    const setupIntent = await stripeService.createSetupIntent(customer.stripeCustomerId);

    res.json({
      success: true,
      data: {
        clientSecret: setupIntent.client_secret
      }
    });

  } catch (error) {
    logger.error('Failed to create setup intent via API', {
      shopId: req.params.shopId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create setup intent'
    });
  }
});

/**
 * @swagger
 * /api/shops/{shopId}/subscription:
 *   delete:
 *     summary: Cancel subscription
 *     tags: [Shop Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shop ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               immediately:
 *                 type: boolean
 *                 default: false
 *                 description: Cancel immediately or at period end
 *     responses:
 *       200:
 *         description: Subscription canceled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: No active subscription found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:shopId/subscription', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const { immediately = false } = req.body;

    // Validate shop ownership
    if (req.user?.role !== 'admin' && req.user?.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'You can only cancel your own subscription'
      });
    }

    const subscriptionService = getSubscriptionService();
    const updatedSubscription = await subscriptionService.cancelSubscription(shopId, immediately);

    res.json({
      success: true,
      data: updatedSubscription,
      message: immediately ? 
        'Subscription canceled immediately' : 
        'Subscription will be canceled at the end of the current period'
    });

  } catch (error) {
    logger.error('Failed to cancel subscription via API', {
      shopId: req.params.shopId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    const statusCode = error instanceof Error && error.message.includes('No active') ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription'
    });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Subscription:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         shopId:
 *           type: string
 *         stripeCustomerId:
 *           type: string
 *         stripeSubscriptionId:
 *           type: string
 *         stripePriceId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, past_due, canceled, unpaid, incomplete]
 *         currentPeriodStart:
 *           type: string
 *           format: date-time
 *         currentPeriodEnd:
 *           type: string
 *           format: date-time
 *         cancelAtPeriodEnd:
 *           type: boolean
 *         canceledAt:
 *           type: string
 *           format: date-time
 *         endedAt:
 *           type: string
 *           format: date-time
 *         trialEnd:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     Customer:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         shopId:
 *           type: string
 *         stripeCustomerId:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         name:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

// DEPRECATED: Enrollment endpoints removed - commitment system no longer in use
// The system now uses Stripe subscriptions exclusively
/*
router.get('/subscription/enrollment/:enrollmentId', async (req: Request, res: Response) => {
  try {
    const enrollmentId = parseInt(req.params.enrollmentId);
    const shopId = req.user?.shopId;
    
    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    if (isNaN(enrollmentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid enrollment ID'
      });
    }

    const commitmentRepo = new CommitmentRepository();
    const enrollment = await commitmentRepo.getEnrollmentById(enrollmentId);
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found'
      });
    }

    // Verify this enrollment belongs to the requesting shop
    if (enrollment.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to view this enrollment'
      });
    }

    // Get shop details
    const shopResult = await DatabaseService.getInstance().getPool().query(
      'SELECT name, email, phone FROM shops WHERE shop_id = $1',
      [shopId]
    );

    res.json({
      success: true,
      data: {
        ...enrollment,
        shopDetails: shopResult.rows[0] ? {
          companyName: shopResult.rows[0].name,
          email: shopResult.rows[0].email,
          phoneNumber: shopResult.rows[0].phone
        } : null
      }
    });

  } catch (error) {
    logger.error('Failed to get enrollment details', {
      error: error instanceof Error ? error.message : 'Unknown error',
      enrollmentId: req.params.enrollmentId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get enrollment details'
    });
  }
});
*/

// DEPRECATED: Public enrollment endpoint removed - commitment system no longer in use
/*
publicRouter.get('/subscription/enrollment-public/:enrollmentId', async (req: Request, res: Response) => {
  try {
    const enrollmentId = parseInt(req.params.enrollmentId);
    
    if (isNaN(enrollmentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid enrollment ID'
      });
    }

    const commitmentRepo = new CommitmentRepository();
    const enrollment = await commitmentRepo.getEnrollmentById(enrollmentId);
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found'
      });
    }

    // Only return if enrollment is pending (for payment setup)
    if (enrollment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'This enrollment is no longer pending payment'
      });
    }

    // Get shop details
    const shopResult = await DatabaseService.getInstance().getPool().query(
      'SELECT name, email, phone FROM shops WHERE shop_id = $1',
      [enrollment.shopId]
    );

    res.json({
      success: true,
      data: {
        ...enrollment,
        shopDetails: shopResult.rows[0] ? {
          companyName: shopResult.rows[0].name,
          email: shopResult.rows[0].email,
          phoneNumber: shopResult.rows[0].phone
        } : null
      }
    });

  } catch (error) {
    logger.error('Failed to get public enrollment details', {
      error: error instanceof Error ? error.message : 'Unknown error',
      enrollmentId: req.params.enrollmentId,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get enrollment details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
*/

// DEPRECATED: Payment intent endpoint removed - now using Stripe checkout
/*
router.post('/subscription/payment/intent', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { enrollmentId } = req.body;
    
    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    const enrollmentIdNum = parseInt(enrollmentId);
    if (isNaN(enrollmentIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid enrollment ID'
      });
    }

    const commitmentRepo = new CommitmentRepository();
    const enrollment = await commitmentRepo.getEnrollmentById(enrollmentIdNum);
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found'
      });
    }

    // Verify ownership
    if (enrollment.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to access this enrollment'
      });
    }

    // Verify enrollment is pending
    if (enrollment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Enrollment is not in pending status'
      });
    }

    const stripeService = getStripeService();
    
    // Get or create Stripe customer
    const shopResult = await DatabaseService.getInstance().getPool().query(
      'SELECT name, email FROM shops WHERE shop_id = $1',
      [shopId]
    );
    
    if (!shopResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }
    
    const shop = shopResult.rows[0];
    
    // Check if shop already has a Stripe customer
    let stripeCustomerId: string;
    const customerResult = await DatabaseService.getInstance().getPool().query(
      'SELECT stripe_customer_id FROM stripe_customers WHERE shop_id = $1',
      [shopId]
    );
    
    if (customerResult.rows[0]?.stripe_customer_id) {
      stripeCustomerId = customerResult.rows[0].stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripeService.createCustomer({
        email: enrollment.billingReference || shop.email,
        name: shop.name,
        shopId: shopId
      });
      stripeCustomerId = customer.id;
      
      // Save customer ID
      await DatabaseService.getInstance().getPool().query(
        `INSERT INTO stripe_customers (shop_id, stripe_customer_id, email, name) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (shop_id) DO UPDATE 
         SET stripe_customer_id = $2, email = $3, name = $4`,
        [shopId, stripeCustomerId, enrollment.billingReference || shop.email, shop.name]
      );
    }
    
    // Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: enrollment.monthlyAmount * 100, // Convert to cents
      currency: 'usd',
      customerId: stripeCustomerId,
      metadata: {
        enrollmentId: enrollmentId,
        shopId: shopId,
        type: 'commitment_subscription'
      },
      description: `Monthly subscription for ${shop.name}`
    });
    
    logger.info('Payment intent created for commitment subscription', {
      enrollmentId: enrollmentIdNum,
      shopId,
      paymentIntentId: paymentIntent.id,
      amount: enrollment.monthlyAmount
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: enrollment.monthlyAmount,
        currency: 'usd'
      }
    });

  } catch (error) {
    logger.error('Failed to create payment intent', {
      error: error instanceof Error ? error.message : 'Unknown error',
      shopId: req.user?.shopId
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment intent'
    });
  }
});
*/

// DEPRECATED: Payment confirm endpoint removed - Stripe webhook handles this
/*
router.post('/subscription/payment/confirm', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { enrollmentId, paymentMethodId, amount } = req.body;
    
    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    const enrollmentIdNum = parseInt(enrollmentId);
    if (isNaN(enrollmentIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid enrollment ID'
      });
    }

    const commitmentRepo = new CommitmentRepository();
    const enrollment = await commitmentRepo.getEnrollmentById(enrollmentIdNum);
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found'
      });
    }

    // Verify ownership
    if (enrollment.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to confirm this payment'
      });
    }

    // Verify enrollment is pending
    if (enrollment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Enrollment is not in pending status'
      });
    }

    // In production, this would process the payment with Stripe
    // For now, we'll simulate successful payment and activate the subscription

    // Record the payment
    await commitmentRepo.recordPayment(enrollmentIdNum, amount, new Date());

    // Activate the enrollment
    const activated = await commitmentRepo.updateEnrollmentStatus(
      enrollmentIdNum,
      'active',
      {
        activatedAt: new Date()
      }
    );

    // Update shop operational status
    await DatabaseService.getInstance().getPool().query(
      `UPDATE shops 
       SET operational_status = 'commitment_qualified',
           commitment_enrolled = true
       WHERE shop_id = $1`,
      [shopId]
    );

    logger.info('Commitment subscription activated via payment', {
      enrollmentId: enrollmentIdNum,
      shopId,
      amount,
      paymentMethodId
    });

    res.json({
      success: true,
      data: {
        enrollment: activated,
        message: 'Payment successful! Your subscription is now active.'
      }
    });

  } catch (error) {
    logger.error('Failed to confirm payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      shopId: req.user?.shopId
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm payment'
    });
  }
});
*/

// DEPRECATED: Commitment cancellation endpoint - use DELETE /:shopId/subscription instead
/*
router.post('/subscription/cancel', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { reason } = req.body;
    
    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    const commitmentRepo = new CommitmentRepository();
    
    // Check if shop has active enrollment
    const activeEnrollment = await commitmentRepo.getActiveEnrollmentByShopId(shopId);
    
    if (!activeEnrollment) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Cancel the enrollment
    const cancelledEnrollment = await commitmentRepo.updateEnrollmentStatus(
      activeEnrollment.id!,
      'cancelled',
      {
        cancelledAt: new Date(),
        cancellationReason: reason || 'Cancelled by shop owner'
      }
    );

    logger.info('Commitment subscription cancelled', {
      shopId,
      enrollmentId: activeEnrollment.id,
      reason
    });

    res.json({
      success: true,
      data: {
        message: 'Subscription cancelled successfully. You can resubscribe at any time.',
        enrollment: cancelledEnrollment
      }
    });

  } catch (error) {
    logger.error('Failed to cancel subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
      shopId: req.user?.shopId
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription'
    });
  }
});
*/

/**
 * @swagger
 * /api/shops/subscription/debug/{shopId}:
 *   get:
 *     summary: Debug subscription status for a shop
 *     tags: [Shop Subscriptions]
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shop ID
 *     responses:
 *       200:
 *         description: Debug information
 */
publicRouter.get('/subscription/debug/:shopId', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;

    logger.info('🔍 DEBUG - Starting subscription debug for shop:', shopId);

    // Check stripe_subscriptions table
    const subscriptionsQuery = `
      SELECT * FROM stripe_subscriptions 
      WHERE shop_id = $1 
      ORDER BY created_at DESC
    `;
    const subscriptionsResult = await DatabaseService.getInstance().getPool().query(subscriptionsQuery, [shopId]);
    
    // Check stripe_customers table
    const customersQuery = `SELECT * FROM stripe_customers WHERE shop_id = $1`;
    const customersResult = await DatabaseService.getInstance().getPool().query(customersQuery, [shopId]);
    
    // Check shop record
    const shopQuery = `SELECT * FROM shops WHERE shop_id = $1`;
    const shopResult = await DatabaseService.getInstance().getPool().query(shopQuery, [shopId]);

    const debugInfo = {
      shopId,
      shop: shopResult.rows[0] || null,
      stripeSubscriptions: subscriptionsResult.rows,
      stripeCustomers: customersResult.rows,
      subscriptionService: {
        found: subscriptionsResult.rows.length > 0 ? subscriptionsResult.rows[0] : null
      }
    };

    logger.info('🔍 DEBUG - Database results:', JSON.stringify(debugInfo, null, 2));

    res.json({
      success: true,
      data: debugInfo
    });

  } catch (error) {
    logger.error('❌ DEBUG - Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Debug failed'
    });
  }
});

// Export both routers
export default router;
export { publicRouter };