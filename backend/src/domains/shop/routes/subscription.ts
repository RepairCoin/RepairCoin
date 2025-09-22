import { Router, Request, Response } from 'express';
import { getSubscriptionService } from '../../../services/SubscriptionService';
import { getStripeService } from '../../../services/StripeService';
import { logger } from '../../../utils/logger';
import { authMiddleware } from '../../../middleware/auth';
// CommitmentRepository removed - commitment system deprecated in favor of Stripe subscriptions
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

    console.log('🔍 SUBSCRIPTION STATUS - Checking for shop:', { 
      shopId, 
      user: req.user 
    });

    // Check for Stripe subscription only (commitment enrollment system removed)
    const subscriptionService = getSubscriptionService();
    const stripeSubscription = await subscriptionService.getActiveSubscription(shopId);
    
    if (stripeSubscription) {
      // Log subscription found
      console.log('✅ BACKEND - SUBSCRIPTION STATUS: TRUE - Active subscription found for shop:', {
        shopId,
        subscriptionId: stripeSubscription.stripeSubscriptionId,
        status: stripeSubscription.status,
        stripePriceId: stripeSubscription.stripePriceId,
        currentPeriodEnd: stripeSubscription.currentPeriodEnd
      });

      // Return Stripe subscription data
      res.json({
        success: true,
        data: {
          currentSubscription: {
            id: stripeSubscription.id,
            status: stripeSubscription.status,
            monthlyAmount: stripeSubscription.stripePriceId === process.env.STRIPE_MONTHLY_PRICE_ID ? 500 : 0,
            subscriptionType: 'stripe_subscription',
            billingMethod: 'credit_card',
            nextPaymentDate: new Date(stripeSubscription.currentPeriodEnd).toISOString(),
            lastPaymentDate: null, // Stripe subscriptions don't track lastPaymentDate in our current schema
            enrolledAt: stripeSubscription.createdAt
          },
          hasActiveSubscription: true
        }
      });
    } else {
      console.log('❌ BACKEND - SUBSCRIPTION STATUS: FALSE - No active subscription found for shop:', { shopId });
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

    // Note: commitment_enrollments table was removed in migration 015
    // No cleanup needed as we only use Stripe subscriptions now

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

/**
 * @swagger
 * /api/shops/subscription/enrollment/{enrollmentId}:
 *   get:
 *     summary: Get enrollment details
 *     tags: [Shop Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Enrollment ID
 *     responses:
 *       200:
 *         description: Enrollment details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Enrollment not found
 */
router.get('/subscription/enrollment/:enrollmentId', async (req: Request, res: Response) => {
  // Commitment enrollments deprecated - use Stripe subscriptions
  return res.status(410).json({
    success: false,
    error: 'Commitment enrollments have been deprecated. Please use Stripe subscription system instead.'
  });
});

/**
 * @swagger
 * /api/shops/subscription/enrollment-public/{enrollmentId}:
 *   get:
 *     summary: Get enrollment details for payment page (no auth required)
 *     tags: [Shop Subscriptions]
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Enrollment ID
 *     responses:
 *       200:
 *         description: Enrollment details
 *       404:
 *         description: Enrollment not found
 */
publicRouter.get('/subscription/enrollment-public/:enrollmentId', async (req: Request, res: Response) => {
  // Commitment enrollments deprecated - use Stripe subscriptions
  return res.status(410).json({
    success: false,
    error: 'Commitment enrollments have been deprecated. Please use Stripe subscription system instead.'
  });
});

/**
 * @swagger
 * /api/shops/subscription/payment/intent:
 *   post:
 *     summary: Create payment intent for subscription
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
 *               enrollmentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment intent created
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/subscription/payment/intent', async (req: Request, res: Response) => {
  // Payment intents deprecated - use Stripe subscriptions
  return res.status(410).json({
    success: false,
    error: 'Payment intents have been deprecated. Please use Stripe subscription system instead.'
  });
});

/**
 * @swagger
 * /api/shops/subscription/payment/confirm:
 *   post:
 *     summary: Confirm payment and activate subscription
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
 *               enrollmentId:
 *                 type: string
 *               paymentIntentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment confirmed
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/subscription/payment/confirm', async (req: Request, res: Response) => {
  // Payment confirmation deprecated - use Stripe subscriptions
  return res.status(410).json({
    success: false,
    error: 'Payment confirmation has been deprecated. Please use Stripe subscription system instead.'
  });
});

/**
 * @swagger
 * /api/shops/subscription/cancel:
 *   post:
 *     summary: Cancel commitment subscription
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
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription cancelled
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/subscription/cancel', async (req: Request, res: Response) => {
  // Commitment cancellation deprecated - use Stripe subscriptions
  return res.status(410).json({
    success: false,
    error: 'Commitment cancellation has been deprecated. Please use Stripe subscription cancellation instead.'
  });
});

/**
 * @swagger
 * /api/shops/subscription/health:
 *   get:
 *     summary: Check Stripe service health and configuration
 *     tags: [Shop Subscriptions]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy or misconfigured
 */
publicRouter.get('/subscription/health', async (req: Request, res: Response) => {
  try {
    // Check if Stripe service can be initialized
    const stripeService = getStripeService();
    
    // Check required environment variables
    const config = {
      hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasPriceId: !!process.env.STRIPE_MONTHLY_PRICE_ID,
      secretKeyPrefix: process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.substring(0, 7) : 'missing',
      priceId: process.env.STRIPE_MONTHLY_PRICE_ID || 'missing',
      environment: process.env.NODE_ENV || 'development'
    };
    
    const isHealthy = config.hasSecretKey && config.hasWebhookSecret && config.hasPriceId;
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      config: config,
      message: isHealthy ? 'Stripe service is properly configured' : 'Stripe service is missing required configuration'
    });
    
  } catch (error) {
    logger.error('Stripe health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(503).json({
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to check Stripe service health',
      message: 'Stripe service initialization failed'
    });
  }
});

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
    
    console.log('🔍 DEBUG - Starting subscription debug for shop:', shopId);

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

    console.log('🔍 DEBUG - Database results:', JSON.stringify(debugInfo, null, 2));

    res.json({
      success: true,
      data: debugInfo
    });

  } catch (error) {
    console.error('❌ DEBUG - Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Debug failed'
    });
  }
});

// Export both routers
export default router;
export { publicRouter };