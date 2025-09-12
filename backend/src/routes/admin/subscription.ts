import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { shopSubscriptionRepository, shopRepository } from '../../repositories';
import { logger } from '../../utils/logger';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply admin authentication to all routes
router.use(requireAdmin);

/**
 * Get all subscriptions with filters
 */
router.get('/subscriptions', asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;
  
  let subscriptions;
  if (status === 'pending') {
    subscriptions = await shopSubscriptionRepository.getPendingSubscriptions();
  } else if (status === 'active') {
    subscriptions = await shopSubscriptionRepository.getActiveSubscriptions();
  } else {
    // Get all subscriptions
    const pending = await shopSubscriptionRepository.getPendingSubscriptions();
    const active = await shopSubscriptionRepository.getActiveSubscriptions();
    subscriptions = [...pending, ...active];
  }
  
  res.json({
    success: true,
    data: subscriptions
  });
}));

/**
 * Create new subscription for a shop (admin initiated)
 */
router.post('/subscriptions', asyncHandler(async (req: Request, res: Response) => {
  const {
    shopId,
    monthlyAmount = 500,
    subscriptionType = 'standard',
    billingMethod,
    notes
  } = req.body;
  
  // Verify shop exists
  const shop = await shopRepository.getShop(shopId);
  if (!shop) {
    return res.status(404).json({
      success: false,
      error: 'Shop not found'
    });
  }
  
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
    monthlyAmount,
    subscriptionType,
    billingMethod,
    paymentsMade: 0,
    totalPaid: 0,
    notes,
    createdBy: (req as any).admin?.walletAddress
  });
  
  res.json({
    success: true,
    data: subscription
  });
}));

/**
 * Approve pending subscription
 */
router.post('/subscriptions/:id/approve', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { billingReference, nextPaymentDate } = req.body;
  
  const subscription = await shopSubscriptionRepository.getSubscriptionById(parseInt(id));
  if (!subscription) {
    return res.status(404).json({
      success: false,
      error: 'Subscription not found'
    });
  }
  
  if (subscription.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: 'Only pending subscriptions can be approved'
    });
  }
  
  // Activate subscription
  const updated = await shopSubscriptionRepository.updateSubscriptionStatus(
    parseInt(id),
    'active',
    {
      activatedAt: new Date()
    }
  );
  
  // Update shop operational status
  await shopRepository.updateShop(subscription.shopId, {
    commitment_enrolled: true,
    operational_status: 'commitment_qualified'
  });
  
  res.json({
    success: true,
    data: updated
  });
}));

/**
 * Cancel subscription (admin)
 */
router.post('/subscriptions/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  const subscription = await shopSubscriptionRepository.getSubscriptionById(parseInt(id));
  if (!subscription) {
    return res.status(404).json({
      success: false,
      error: 'Subscription not found'
    });
  }
  
  const updated = await shopSubscriptionRepository.cancelSubscription(
    parseInt(id),
    reason || 'Cancelled by admin'
  );
  
  // Update shop operational status
  const shop = await shopRepository.getShop(subscription.shopId);
  if (shop) {
    const rcgBalance = parseFloat(String(shop.rcg_balance || '0'));
    await shopRepository.updateShop(subscription.shopId, {
      commitment_enrolled: false,
      operational_status: rcgBalance >= 10000 ? 'rcg_qualified' : 'not_qualified'
    });
  }
  
  res.json({
    success: true,
    data: updated
  });
}));

/**
 * Pause subscription
 */
router.post('/subscriptions/:id/pause', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const subscription = await shopSubscriptionRepository.getSubscriptionById(parseInt(id));
  if (!subscription) {
    return res.status(404).json({
      success: false,
      error: 'Subscription not found'
    });
  }
  
  const updated = await shopSubscriptionRepository.pauseSubscription(parseInt(id));
  
  res.json({
    success: true,
    data: updated
  });
}));

/**
 * Resume subscription
 */
router.post('/subscriptions/:id/resume', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const subscription = await shopSubscriptionRepository.getSubscriptionById(parseInt(id));
  if (!subscription) {
    return res.status(404).json({
      success: false,
      error: 'Subscription not found'
    });
  }
  
  const updated = await shopSubscriptionRepository.resumeSubscription(parseInt(id));
  
  res.json({
    success: true,
    data: updated
  });
}));

/**
 * Record payment for subscription
 */
router.post('/subscriptions/:id/payment', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, paymentDate } = req.body;
  
  await shopSubscriptionRepository.recordPayment(
    parseInt(id),
    amount || 500,
    paymentDate ? new Date(paymentDate) : new Date()
  );
  
  res.json({
    success: true,
    message: 'Payment recorded successfully'
  });
}));

/**
 * Get overdue subscriptions
 */
router.get('/overdue', asyncHandler(async (req: Request, res: Response) => {
  const overdue = await shopSubscriptionRepository.getOverduePayments();
  
  res.json({
    success: true,
    data: overdue
  });
}));

/**
 * Process defaulted subscriptions (cron job endpoint)
 */
router.post('/process-defaults', asyncHandler(async (req: Request, res: Response) => {
  const { gracePeriodDays = 7 } = req.body;
  
  const defaultedCount = await shopSubscriptionRepository.checkAndDefaultOverdueSubscriptions(gracePeriodDays);
  
  res.json({
    success: true,
    data: {
      defaultedCount,
      message: `${defaultedCount} subscriptions marked as defaulted`
    }
  });
}));

export default router;