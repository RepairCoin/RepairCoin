import { Router, Request, Response } from 'express';
import { getStripeService } from '../../../services/StripeService';
import { logger } from '../../../utils/logger';
import { authMiddleware, requireRole } from '../../../middleware/auth';
import { DatabaseService } from '../../../services/DatabaseService';
import { shopRepository } from '../../../repositories';

const router = Router();

// Apply authentication middleware
router.use(authMiddleware);
router.use(requireRole(['shop']));

/**
 * @swagger
 * /api/shops/payment-methods:
 *   get:
 *     summary: Get shop's saved payment methods
 *     tags: [Shop Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payment methods
 */
router.get('/payment-methods', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    logger.debug('Fetching payment methods for shop', { shopId });

    // Get shop's Stripe customer ID
    const shop = await shopRepository.getShop(shopId);
    if (!shop || !shop.stripeCustomerId) {
      return res.json({
        success: true,
        paymentMethods: [],
        message: 'No Stripe customer found'
      });
    }

    const stripeService = getStripeService();
    const paymentMethods = await stripeService.listPaymentMethods(shop.stripeCustomerId);

    return res.json({
      success: true,
      paymentMethods: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        } : null,
        isDefault: pm.id === shop.defaultPaymentMethodId,
        createdAt: new Date(pm.created * 1000).toISOString()
      }))
    });

  } catch (error: any) {
    logger.error('Error fetching payment methods:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payment methods'
    });
  }
});

/**
 * @swagger
 * /api/shops/payment-methods/setup-intent:
 *   post:
 *     summary: Create a setup intent for adding new payment method
 *     tags: [Shop Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Setup intent created
 */
router.post('/payment-methods/setup-intent', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    logger.debug('Creating setup intent for shop', { shopId });

    // Get or create Stripe customer
    let shop = await shopRepository.getShop(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }

    const stripeService = getStripeService();
    let customerId = shop.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripeService.createCustomer({
        email: shop.email,
        name: shop.name,
        shopId: shop.shopId,
        metadata: {
          walletAddress: shop.walletAddress
        }
      });
      customerId = customer.id;

      // Update shop with customer ID
      await shopRepository.updateShop(shopId, { stripeCustomerId: customerId });
    }

    // Create setup intent
    const setupIntent = await stripeService.createSetupIntent(customerId);

    return res.json({
      success: true,
      clientSecret: setupIntent.client_secret
    });

  } catch (error: any) {
    logger.error('Error creating setup intent:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create setup intent'
    });
  }
});

/**
 * @swagger
 * /api/shops/payment-methods/{paymentMethodId}/set-default:
 *   post:
 *     summary: Set a payment method as default
 *     tags: [Shop Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentMethodId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Default payment method updated
 */
router.post('/payment-methods/:paymentMethodId/set-default', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { paymentMethodId } = req.params;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    logger.debug('Setting default payment method', { shopId, paymentMethodId });

    const shop = await shopRepository.getShop(shopId);
    if (!shop || !shop.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        error: 'Shop or Stripe customer not found'
      });
    }

    const stripeService = getStripeService();

    // Attach payment method to customer (if not already attached)
    await stripeService.attachPaymentMethod(paymentMethodId, shop.stripeCustomerId);

    // Set as default
    await stripeService.setDefaultPaymentMethod(shop.stripeCustomerId, paymentMethodId);

    // Update in our database
    await shopRepository.updateShop(shopId, { defaultPaymentMethodId: paymentMethodId });

    return res.json({
      success: true,
      message: 'Default payment method updated successfully'
    });

  } catch (error: any) {
    logger.error('Error setting default payment method:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to set default payment method'
    });
  }
});

/**
 * @swagger
 * /api/shops/payment-methods/{paymentMethodId}:
 *   delete:
 *     summary: Delete a payment method
 *     tags: [Shop Payment Methods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentMethodId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment method deleted
 */
router.delete('/payment-methods/:paymentMethodId', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { paymentMethodId } = req.params;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop ID not found in token'
      });
    }

    logger.debug('Deleting payment method', { shopId, paymentMethodId });

    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }

    // Check if this is the default payment method
    if (shop.defaultPaymentMethodId === paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete default payment method. Please set another payment method as default first.'
      });
    }

    const stripeService = getStripeService();
    await stripeService.detachPaymentMethod(paymentMethodId);

    return res.json({
      success: true,
      message: 'Payment method deleted successfully'
    });

  } catch (error: any) {
    logger.error('Error deleting payment method:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete payment method'
    });
  }
});

export default router;
