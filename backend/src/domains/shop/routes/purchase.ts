// backend/src/domains/shop/routes/purchase.ts
import { Router, Request, Response } from 'express';
import { shopPurchaseService, PurchaseRequest } from '../services/ShopPurchaseService';
import { logger } from '../../../utils/logger';
import { DatabaseService } from '../../../services/DatabaseService';
import { getStripeService } from '../../../services/StripeService';
import { shopRepository } from '../../../repositories';
import { requireActiveSubscription } from '../../../middleware/auth';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PurchaseRequest:
 *       type: object
 *       required:
 *         - shopId
 *         - amount
 *         - paymentMethod
 *       properties:
 *         shopId:
 *           type: string
 *           description: Shop identifier
 *         amount:
 *           type: number
 *           minimum: 100
 *           description: Amount of RCN to purchase (minimum 100)
 *         paymentMethod:
 *           type: string
 *           enum: [credit_card, bank_transfer, usdc, eth]
 *           description: Payment method for purchase
 *         paymentReference:
 *           type: string
 *           description: Optional payment reference number
 *     PurchaseResponse:
 *       type: object
 *       properties:
 *         purchaseId:
 *           type: string
 *           description: Unique purchase identifier
 *         totalCost:
 *           type: number
 *           description: Total cost in USD
 *         status:
 *           type: string
 *           enum: [pending, completed, failed]
 *           description: Purchase status
 *         message:
 *           type: string
 *           description: Human-readable status message
 */

/**
 * @swagger
 * /api/shops/purchase/initiate:
 *   post:
 *     summary: Initiate shop RCN purchase
 *     tags: [Shop Purchase]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseRequest'
 *     responses:
 *       200:
 *         description: Purchase initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseResponse'
 *       400:
 *         description: Invalid purchase request
 *       404:
 *         description: Shop not found
 *       500:
 *         description: Internal server error
 */
router.post('/initiate', requireActiveSubscription(), async (req: Request, res: Response) => {
  try {
    logger.info('Shop purchase initiate request:', {
      body: req.body,
      headers: req.headers['content-type']
    });

    // Validate required fields
    if (!req.body.shopId) {
      throw new Error('shopId is required');
    }
    if (!req.body.amount || req.body.amount < 1) {
      throw new Error('amount must be at least 1');
    }
    if (!req.body.paymentMethod) {
      throw new Error('paymentMethod is required');
    }

    const purchaseData: PurchaseRequest = {
      shopId: req.body.shopId,
      amount: Number(req.body.amount),
      paymentMethod: req.body.paymentMethod,
      paymentReference: req.body.paymentReference
    };

    logger.info('Processing purchase request:', purchaseData);

    const result = await shopPurchaseService.purchaseRcn(purchaseData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error initiating shop purchase:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body
    });
    
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate purchase'
    });
  }
});

/**
 * @swagger
 * /api/shops/purchase/complete:
 *   post:
 *     summary: Complete shop RCN purchase
 *     tags: [Shop Purchase]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - purchaseId
 *             properties:
 *               purchaseId:
 *                 type: string
 *                 description: Purchase ID from initiate request
 *               paymentReference:
 *                 type: string
 *                 description: Payment confirmation reference
 *     responses:
 *       200:
 *         description: Purchase completed successfully
 *       400:
 *         description: Invalid completion request
 *       404:
 *         description: Purchase not found
 *       500:
 *         description: Internal server error
 */
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { purchaseId, paymentReference } = req.body;

    if (!purchaseId) {
      return res.status(400).json({
        success: false,
        error: 'Purchase ID is required'
      });
    }

    const result = await shopPurchaseService.completePurchase(purchaseId, paymentReference);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error completing shop purchase:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete purchase'
    });
  }
});

/**
 * @swagger
 * /api/shops/purchase/balance/{shopId}:
 *   get:
 *     summary: Get shop RCN balance and statistics
 *     tags: [Shop Purchase]
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shop identifier
 *     responses:
 *       200:
 *         description: Shop balance information
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
 *                     currentBalance:
 *                       type: number
 *                       description: Current RCN balance
 *                     totalPurchased:
 *                       type: number
 *                       description: Total RCN purchased all time
 *                     totalDistributed:
 *                       type: number
 *                       description: Total RCN distributed to customers
 *                     lastPurchaseDate:
 *                       type: string
 *                       format: date-time
 *                       description: Date of last purchase
 *                     recommendedPurchase:
 *                       type: number
 *                       description: Recommended next purchase amount
 *       404:
 *         description: Shop not found
 *       500:
 *         description: Internal server error
 */
router.get('/balance/:shopId', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const balance = await shopPurchaseService.getShopBalance(shopId);

    res.json({
      success: true,
      data: balance
    });

  } catch (error) {
    logger.error('Error getting shop balance:', error);
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve shop balance'
    });
  }
});

/**
 * @swagger
 * /api/shops/purchase/history/{shopId}:
 *   get:
 *     summary: Get shop RCN purchase history
 *     tags: [Shop Purchase]
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shop identifier
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Purchase history retrieved successfully
 *       404:
 *         description: Shop not found
 *       500:
 *         description: Internal server error
 */
router.get('/history/:shopId', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const history = await shopPurchaseService.getPurchaseHistory(shopId, page, limit, startDate, endDate);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    logger.error('Error getting purchase history:', error);
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve purchase history'
    });
  }
});

/**
 * @swagger
 * /api/shops/purchase/stripe-checkout:
 *   post:
 *     summary: Create Stripe checkout session for RCN purchase
 *     tags: [Shop Purchase]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 100
 *                 description: Amount of RCN to purchase
 *     responses:
 *       200:
 *         description: Checkout session created
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
 *                     checkoutUrl:
 *                       type: string
 *                       description: Stripe checkout URL
 *                     sessionId:
 *                       type: string
 *                       description: Stripe session ID
 *                     purchaseId:
 *                       type: string
 *                       description: Internal purchase ID
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/stripe-checkout', requireActiveSubscription(), async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { amount } = req.body;
    
    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    // Stripe requires minimum $0.50, so at $0.10 per RCN, minimum is 5 RCN
    if (!amount || amount < 5) {
      return res.status(400).json({
        success: false,
        error: 'Minimum purchase amount is 5 RCN ($0.50 USD) due to payment processor requirements'
      });
    }

    // Get shop details
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    // Create purchase record first
    const purchaseRequest: PurchaseRequest = {
      shopId,
      amount: Number(amount),
      paymentMethod: 'credit_card',
      paymentReference: 'stripe_checkout_pending'
    };

    const purchaseResult = await shopPurchaseService.purchaseRcn(purchaseRequest);
    const unitPrice = purchaseResult.totalCost / amount;

    // Get or create Stripe customer
    const stripeService = getStripeService();
    const db = DatabaseService.getInstance();
    
    let stripeCustomer;
    const customerQuery = `SELECT stripe_customer_id FROM stripe_customers WHERE shop_id = $1`;
    const customerResult = await db.query(customerQuery, [shopId]);
    
    if (customerResult.rows.length > 0) {
      stripeCustomer = { id: customerResult.rows[0].stripe_customer_id };
    } else {
      // Create new Stripe customer
      const customer = await stripeService.createCustomer({
        email: shop.email,
        name: shop.name,
        shopId: shopId
      });
      
      // Save to database
      await db.query(
        `INSERT INTO stripe_customers (shop_id, stripe_customer_id, email, name) 
         VALUES ($1, $2, $3, $4)`,
        [shopId, customer.id, shop.email, shop.name]
      );
      
      stripeCustomer = customer;
    }

    // Detect if request is from mobile app
    const userAgent = req.headers['user-agent'] || '';
    const isMobileApp = userAgent.includes('Expo') || userAgent.includes('okhttp') || req.query.platform === 'mobile';
    
    // Set appropriate redirect URLs based on platform
    let successUrl: string;
    let cancelUrl: string;
    
    if (isMobileApp) {
      // Use deep links for mobile app
      successUrl = `khalid2025://shop/purchase-success?purchase_id=${purchaseResult.purchaseId}&amount=${amount}`;
      cancelUrl = `khalid2025://shop/purchase-cancelled`;
    } else {
      // Use web URLs for web platform
      successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/shop?tab=purchase&payment=success&purchase_id=${purchaseResult.purchaseId}`;
      cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/shop?tab=purchase&payment=cancelled`;
    }

    // Create Stripe checkout session
    const stripe = stripeService.getStripe();
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'RepairCoin (RCN) Tokens',
            description: `${amount} RCN tokens at $${unitPrice.toFixed(2)} per token`
          },
          unit_amount: Math.round(unitPrice * 100), // Convert to cents
        },
        quantity: amount,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        shopId: shopId,
        purchaseId: purchaseResult.purchaseId,
        amount: amount.toString(),
        type: 'rcn_purchase'
      }
    });

    logger.info('Stripe checkout session created for RCN purchase', {
      shopId,
      sessionId: session.id,
      purchaseId: purchaseResult.purchaseId,
      amount,
      totalCost: purchaseResult.totalCost
    });

    res.json({
      success: true,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
        purchaseId: purchaseResult.purchaseId,
        amount,
        totalCost: purchaseResult.totalCost
      }
    });

  } catch (error) {
    logger.error('Error creating Stripe checkout for RCN purchase:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create checkout session'
    });
  }
});

/**
 * @swagger
 * /api/shops/purchase/{purchaseId}/cancel:
 *   post:
 *     summary: Cancel a pending purchase
 *     tags: [Shop Purchase]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: purchaseId
 *         required: true
 *         schema:
 *           type: string
 *         description: The purchase ID to cancel
 *     responses:
 *       200:
 *         description: Purchase cancelled successfully
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
 *                     message:
 *                       type: string
 *                     purchaseId:
 *                       type: string
 *       400:
 *         description: Purchase cannot be cancelled
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Purchase not found
 */
/**
 * @swagger
 * /api/shops/purchase/stripe-payment-intent:
 *   post:
 *     summary: Create Stripe PaymentIntent for RCN purchase (Mobile native payment)
 *     tags: [Shop Purchase]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 5
 *                 description: Amount of RCN to purchase
 *     responses:
 *       200:
 *         description: PaymentIntent created
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
 *                       description: PaymentIntent client secret for native mobile payment
 *                     purchaseId:
 *                       type: string
 *                       description: Internal purchase ID
 *                     amount:
 *                       type: number
 *                     totalCost:
 *                       type: number
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/stripe-payment-intent', requireActiveSubscription(), async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { amount } = req.body;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    // Stripe requires minimum $0.50, so at $0.10 per RCN, minimum is 5 RCN
    if (!amount || amount < 5) {
      return res.status(400).json({
        success: false,
        error: 'Minimum purchase amount is 5 RCN ($0.50 USD) due to payment processor requirements'
      });
    }

    // Get shop details
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    // Create purchase record first
    const purchaseRequest: PurchaseRequest = {
      shopId,
      amount: Number(amount),
      paymentMethod: 'credit_card',
      paymentReference: 'stripe_payment_intent_pending'
    };

    const purchaseResult = await shopPurchaseService.purchaseRcn(purchaseRequest);

    // Get or create Stripe customer
    const stripeService = getStripeService();
    const stripe = stripeService.getStripe();
    const db = DatabaseService.getInstance();

    let stripeCustomerId: string;
    const customerQuery = `SELECT stripe_customer_id FROM stripe_customers WHERE shop_id = $1`;
    const customerResult = await db.query(customerQuery, [shopId]);

    if (customerResult.rows.length > 0) {
      stripeCustomerId = customerResult.rows[0].stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripeService.createCustomer({
        email: shop.email,
        name: shop.name,
        shopId: shopId
      });

      // Save to database
      await db.query(
        `INSERT INTO stripe_customers (shop_id, stripe_customer_id, email, name)
         VALUES ($1, $2, $3, $4)`,
        [shopId, customer.id, shop.email, shop.name]
      );

      stripeCustomerId = customer.id;
    }

    // Calculate total cost in cents
    const totalCostCents = Math.round(purchaseResult.totalCost * 100);

    // Create PaymentIntent for native mobile payment
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCostCents,
      currency: 'usd',
      customer: stripeCustomerId,
      metadata: {
        shopId: shopId,
        purchaseId: purchaseResult.purchaseId,
        amount: amount.toString(),
        type: 'rcn_purchase',
        platform: 'mobile'
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      description: `Purchase ${amount} RCN tokens for ${shop.name}`
    });

    // Update purchase with payment intent ID
    await db.query(
      `UPDATE shop_rcn_purchases SET payment_reference = $1 WHERE id = $2`,
      [paymentIntent.id, purchaseResult.purchaseId]
    );

    logger.info('Stripe PaymentIntent created for RCN purchase', {
      shopId,
      paymentIntentId: paymentIntent.id,
      purchaseId: purchaseResult.purchaseId,
      amount,
      totalCost: purchaseResult.totalCost
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        purchaseId: purchaseResult.purchaseId,
        amount,
        totalCost: purchaseResult.totalCost
      }
    });

  } catch (error) {
    logger.error('Error creating Stripe PaymentIntent for RCN purchase:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment intent'
    });
  }
});

router.post('/:purchaseId/cancel', async (req: Request, res: Response) => {
  try {
    const { purchaseId } = req.params;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop authentication required'
      });
    }

    // Cancel the purchase
    const result = await shopPurchaseService.cancelPurchase(purchaseId, shopId);

    res.json({
      success: true,
      data: {
        message: result.message,
        purchaseId: result.purchaseId
      }
    });

  } catch (error) {
    logger.error('Error cancelling purchase:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel purchase'
    });
  }
});

/**
 * @swagger
 * /api/shops/purchase/{purchaseId}/continue:
 *   post:
 *     summary: Get payment URL to continue a pending purchase
 *     tags: [Shop Purchase]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: purchaseId
 *         required: true
 *         schema:
 *           type: string
 *         description: The purchase ID to continue
 *     responses:
 *       200:
 *         description: Payment URL retrieved successfully
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
 *                     paymentUrl:
 *                       type: string
 *                     purchaseId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     status:
 *                       type: string
 */
router.post('/:purchaseId/continue', async (req: Request, res: Response) => {
  try {
    const { purchaseId } = req.params;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop authentication required'
      });
    }

    // Get the pending purchase
    const db = DatabaseService.getInstance();
    const purchaseResult = await db.query(`
      SELECT id, shop_id, amount, payment_reference, status, created_at
      FROM shop_rcn_purchases
      WHERE id = $1 AND shop_id = $2 AND status = 'pending'
    `, [purchaseId, shopId]);

    if (purchaseResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pending purchase not found'
      });
    }

    const purchase = purchaseResult.rows[0];

    // Check if purchase is too old (>24 hours) - might be expired
    const ageHours = (Date.now() - new Date(purchase.created_at).getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) {
      // Mark as failed since it's expired
      await shopRepository.failShopPurchase(purchaseId, 'Purchase expired (>24 hours old)');

      return res.status(400).json({
        success: false,
        error: 'Purchase has expired. Please create a new purchase.'
      });
    }

    let paymentUrl = null;

    // If there's already a payment reference, try to retrieve the session
    if (purchase.payment_reference && purchase.payment_reference.startsWith('cs_')) {
      try {
        const stripeService = getStripeService();
        const session = await stripeService.getCheckoutSession(purchase.payment_reference);

        if (session.status === 'expired') {
          // Mark purchase as failed since session is expired
          await shopRepository.failShopPurchase(purchaseId, 'Stripe checkout session expired');

          return res.status(400).json({
            success: false,
            error: 'Payment session has expired. Please create a new purchase.'
          });
        }

        if (session.status === 'open' && session.url) {
          paymentUrl = session.url;
        }
      } catch (stripeError) {
        logger.warn('Could not retrieve existing Stripe session', {
          purchaseId,
          paymentReference: purchase.payment_reference,
          error: stripeError.message
        });
      }
    }

    // If no valid existing session, create a new one
    if (!paymentUrl) {
      const stripeService = getStripeService();
      
      // Get shop details for customer creation
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Find or create Stripe customer
      let stripeCustomer;
      const stripe = stripeService.getStripe();
      
      try {
        const customers = await stripe.customers.list({
          email: shop.email,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          stripeCustomer = customers.data[0];
        } else {
          stripeCustomer = await stripeService.createCustomer({
            email: shop.email,
            name: shop.name,
            shopId: shop.shopId
          });
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to handle Stripe customer'
        });
      }

      // Create new checkout session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomer.id,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${purchase.amount} RCN Tokens`,
              description: `Purchase ${purchase.amount} RCN tokens for ${shop.name}`
            },
            unit_amount: Math.round((purchase.amount * 0.10) * 100) // $0.10 per RCN in cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/shop/subscription/success?session_id={CHECKOUT_SESSION_ID}&purchase_id=${purchaseId}`,
        cancel_url: `${process.env.FRONTEND_URL}/shop`,
        metadata: {
          shopId,
          purchaseId,
          amount: purchase.amount.toString(),
          type: 'rcn_purchase_continue'
        }
      });

      // Update the purchase with new session ID
      await db.query(`
        UPDATE shop_rcn_purchases
        SET payment_reference = $2
        WHERE id = $1
      `, [purchaseId, session.id]);

      paymentUrl = session.url;

      logger.info('New Stripe checkout session created for continuing purchase', {
        shopId,
        purchaseId,
        sessionId: session.id,
        amount: purchase.amount
      });
    }

    res.json({
      success: true,
      data: {
        paymentUrl,
        purchaseId,
        amount: purchase.amount,
        status: purchase.status
      }
    });

  } catch (error) {
    logger.error('Error continuing purchase payment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to continue payment'
    });
  }
});

export default router;