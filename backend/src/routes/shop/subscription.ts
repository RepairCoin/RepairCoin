import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { shopSubscriptionRepository, shopRepository } from '../../repositories';
import { logger } from '../../utils/logger';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply shop authentication to all routes
router.use(authMiddleware);
router.use(requireRole(['shop']));

/**
 * Get current subscription status for authenticated shop
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const shopId = (req as any).shop?.shopId;
  
  if (!shopId) {
    return res.status(400).json({
      success: false,
      error: 'Shop ID not found in request'
    });
  }
  
  const subscription = await shopSubscriptionRepository.getActiveSubscriptionByShopId(shopId);
  const history = await shopSubscriptionRepository.getShopSubscriptionHistory(shopId);
  
  res.json({
    success: true,
    data: {
      currentSubscription: subscription,
      history: history,
      hasActiveSubscription: !!subscription
    }
  });
}));

/**
 * Check if shop can subscribe (no active subscription, no RCG)
 */
router.get('/eligibility', asyncHandler(async (req: Request, res: Response) => {
  const shopId = (req as any).shop?.shopId;
  
  if (!shopId) {
    return res.status(400).json({
      success: false,
      error: 'Shop ID not found in request'
    });
  }
  
  const eligibility = await shopSubscriptionRepository.canShopSubscribe(shopId);
  
  res.json({
    success: true,
    data: eligibility
  });
}));

/**
 * Create new subscription request
 */
router.post('/subscribe', asyncHandler(async (req: Request, res: Response) => {
  const shopId = (req as any).shop?.shopId;
  const shopWallet = (req as any).shop?.walletAddress;
  
  if (!shopId) {
    return res.status(400).json({
      success: false,
      error: 'Shop ID not found in request'
    });
  }
  
  const { billingMethod, notes } = req.body;
  
  // Check eligibility
  const eligibility = await shopSubscriptionRepository.canShopSubscribe(shopId);
  if (!eligibility.canSubscribe) {
    return res.status(400).json({
      success: false,
      error: eligibility.reason
    });
  }
  
  // Create subscription
  const subscription = await shopSubscriptionRepository.createSubscription({
    shopId,
    status: 'pending',
    monthlyAmount: 500, // Fixed $500/month
    subscriptionType: 'standard',
    billingMethod,
    paymentsMade: 0,
    totalPaid: 0,
    notes,
    createdBy: shopWallet
  });
  
  logger.info(`Subscription created for shop ${shopId}`, { subscriptionId: subscription.id });
  
  res.json({
    success: true,
    data: subscription,
    message: 'Subscription request created. Awaiting payment setup and admin approval.'
  });
}));

/**
 * Cancel active subscription
 */
router.post('/cancel', asyncHandler(async (req: Request, res: Response) => {
  const shopId = (req as any).shop?.shopId;
  
  if (!shopId) {
    return res.status(400).json({
      success: false,
      error: 'Shop ID not found in request'
    });
  }
  
  const { reason } = req.body;
  
  // Get active subscription
  const subscription = await shopSubscriptionRepository.getActiveSubscriptionByShopId(shopId);
  if (!subscription || !subscription.id) {
    return res.status(404).json({
      success: false,
      error: 'No active subscription found'
    });
  }
  
  // Cancel subscription
  const cancelled = await shopSubscriptionRepository.cancelSubscription(
    subscription.id,
    reason || 'Cancelled by shop owner'
  );
  
  // Update shop operational status
  const shop = await shopRepository.getShop(shopId);
  if (shop) {
    const rcgBalance = parseFloat(String(shop.rcg_balance || '0'));
    await shopRepository.updateShop(shopId, {
      commitment_enrolled: false,
      operational_status: rcgBalance >= 10000 ? 'rcg_qualified' : 'not_qualified'
    });
  }
  
  logger.info(`Subscription cancelled for shop ${shopId}`, { subscriptionId: subscription.id });
  
  res.json({
    success: true,
    data: cancelled,
    message: 'Subscription cancelled successfully. You can subscribe again at any time.'
  });
}));

/**
 * Get subscription payment history
 */
router.get('/payments', asyncHandler(async (req: Request, res: Response) => {
  const shopId = (req as any).shop?.shopId;
  
  if (!shopId) {
    return res.status(400).json({
      success: false,
      error: 'Shop ID not found in request'
    });
  }
  
  const history = await shopSubscriptionRepository.getShopSubscriptionHistory(shopId);
  
  // Calculate payment details for each subscription
  const paymentsData = history.map(sub => ({
    subscriptionId: sub.id,
    status: sub.status,
    monthlyAmount: sub.monthlyAmount,
    paymentsMade: sub.paymentsMade,
    totalPaid: sub.totalPaid,
    nextPaymentDate: sub.nextPaymentDate,
    lastPaymentDate: sub.lastPaymentDate,
    enrolledAt: sub.enrolledAt,
    cancelledAt: sub.cancelledAt
  }));
  
  res.json({
    success: true,
    data: paymentsData
  });
}));

/**
 * Pause subscription (admin approval required)
 */
router.post('/pause', asyncHandler(async (req: Request, res: Response) => {
  const shopId = (req as any).shop?.shopId;
  
  if (!shopId) {
    return res.status(400).json({
      success: false,
      error: 'Shop ID not found in request'
    });
  }
  
  // Get active subscription
  const subscription = await shopSubscriptionRepository.getActiveSubscriptionByShopId(shopId);
  if (!subscription || !subscription.id) {
    return res.status(404).json({
      success: false,
      error: 'No active subscription found'
    });
  }
  
  return res.status(403).json({
    success: false,
    error: 'Subscription pause requires admin approval. Please contact support.',
    supportEmail: 'support@repaircoin.com'
  });
}));

/**
 * Reactivate cancelled subscription
 */
router.post('/reactivate', asyncHandler(async (req: Request, res: Response) => {
  const shopId = (req as any).shop?.shopId;
  
  if (!shopId) {
    return res.status(400).json({
      success: false,
      error: 'Shop ID not found in request'
    });
  }
  
  const { paymentMethod } = req.body;
  
  try {
    const { subscriptionService } = await import('../../services/SubscriptionService');
    const subscription = await subscriptionService.reactivateSubscription(shopId, paymentMethod);
    
    res.json({
      success: true,
      data: subscription,
      message: 'Subscription reactivated successfully!'
    });
  } catch (error) {
    logger.error('Error reactivating subscription:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reactivate subscription'
    });
  }
}));

export default router;