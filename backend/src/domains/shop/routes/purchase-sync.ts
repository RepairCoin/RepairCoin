import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { shopAuthMiddleware } from '../../../middleware/shopAuth';
import { logger } from '../../../utils/logger';
import { shopRepository } from '../../../repositories';
import { getStripeService } from '../../../services/StripeService';

const router = Router();

// Apply shop authentication to all routes
router.use(shopAuthMiddleware);

interface AuthenticatedRequest extends Request {
  user?: {
    address: string;
    userType: string;
  };
  shop?: {
    shopId: string;
    walletAddress: string;
  };
}

/**
 * Check and sync payment status with Stripe
 * This helps when webhooks fail
 */
router.post('/check-payment/:purchaseId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { purchaseId } = req.params;
    const shopId = req.shop?.shopId;
    
    if (!shopId) {
      return res.status(401).json({ success: false, error: 'Shop not authenticated' });
    }
    
    // Get purchase from database
    const purchase = await shopRepository.getShopPurchase(purchaseId);
    
    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }
    
    if (purchase.shopId !== shopId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    if (purchase.status !== 'pending') {
      return res.json({
        success: true,
        message: 'Purchase already processed',
        data: { status: purchase.status }
      });
    }
    
    // Check with Stripe if we have a session ID
    if (purchase.paymentReference && purchase.paymentReference.startsWith('cs_')) {
      const stripeService = getStripeService();
      
      try {
        const session = await stripeService.stripe.checkout.sessions.retrieve(
          purchase.paymentReference
        );
        
        logger.info('Stripe session status check', {
          purchaseId,
          sessionId: session.id,
          paymentStatus: session.payment_status,
          status: session.status
        });
        
        if (session.payment_status === 'paid' && session.status === 'complete') {
          // Payment successful, update purchase
          await shopRepository.completeShopPurchase(purchaseId, session.id);
          
          logger.info('Purchase synced and completed', {
            purchaseId,
            shopId,
            amount: purchase.amount
          });
          
          return res.json({
            success: true,
            message: 'Payment verified and purchase completed!',
            data: {
              status: 'completed',
              amount: purchase.amount,
              stripeStatus: session.payment_status
            }
          });
        } else {
          return res.json({
            success: false,
            message: 'Payment not yet complete',
            data: {
              stripeStatus: session.payment_status,
              sessionStatus: session.status
            }
          });
        }
      } catch (stripeError) {
        logger.error('Stripe session check failed', { 
          error: stripeError,
          purchaseId,
          sessionId: purchase.paymentReference 
        });
        
        return res.json({
          success: false,
          error: 'Could not verify payment with Stripe'
        });
      }
    }
    
    // If no Stripe session ID, provide manual completion info
    return res.json({
      success: false,
      message: 'No Stripe session found. Contact support to complete this purchase.',
      data: {
        purchaseId,
        amount: purchase.amount,
        status: purchase.status
      }
    });
    
  } catch (error) {
    logger.error('Error checking payment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check payment status'
    });
  }
}));

/**
 * Get all pending purchases for the shop
 */
router.get('/pending', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.shop?.shopId;
    
    if (!shopId) {
      return res.status(401).json({ success: false, error: 'Shop not authenticated' });
    }
    
    const db = require('../../../services/DatabaseService').DatabaseService.getInstance();
    
    const pendingPurchases = await db.query(`
      SELECT id, amount, total_cost, payment_method, created_at, payment_reference
      FROM shop_rcn_purchases
      WHERE shop_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
    `, [shopId]);
    
    res.json({
      success: true,
      data: pendingPurchases.rows,
      count: pendingPurchases.rowCount
    });
    
  } catch (error) {
    logger.error('Error fetching pending purchases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending purchases'
    });
  }
}));

/**
 * Manually complete a purchase (shop owner override)
 * Use when payment was successful but webhook failed
 */
router.post('/manual-complete/:purchaseId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { purchaseId } = req.params;
    const { confirmationCode } = req.body;
    const shopId = req.shop?.shopId;
    
    if (!shopId) {
      return res.status(401).json({ success: false, error: 'Shop not authenticated' });
    }
    
    // Verify confirmation code (simple verification)
    const expectedCode = `CONFIRM-${String(purchaseId).slice(-6).toUpperCase()}`;
    if (confirmationCode !== expectedCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid confirmation code',
        hint: `Please enter: ${expectedCode}`
      });
    }
    
    // Get purchase from database
    const purchase = await shopRepository.getShopPurchase(purchaseId);
    
    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }
    
    if (purchase.shopId !== shopId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    if (purchase.status !== 'pending') {
      return res.json({
        success: false,
        message: 'Purchase already processed',
        data: { status: purchase.status }
      });
    }
    
    // Complete the purchase
    await shopRepository.completeShopPurchase(
      purchaseId, 
      `MANUAL_SHOP_${Date.now()}`
    );
    
    logger.info('Shop manually completed purchase', {
      purchaseId,
      shopId,
      amount: purchase.amount,
      shopWallet: req.shop?.walletAddress
    });
    
    return res.json({
      success: true,
      message: 'Purchase completed successfully!',
      data: {
        status: 'completed',
        amount: purchase.amount,
        message: 'Your RCN will be processed according to current minting settings'
      }
    });
    
  } catch (error) {
    logger.error('Error manually completing purchase:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete purchase'
    });
  }
}));

export default router;