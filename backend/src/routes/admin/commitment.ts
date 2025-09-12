import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { commitmentRepository, shopRepository } from '../../repositories';
import { logger } from '../../utils/logger';

const router = Router();

// Apply admin authentication to all routes
router.use(requireAdmin);

/**
 * Get all commitment enrollments with filters
 */
router.get('/enrollments', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    
    let enrollments;
    if (status === 'pending') {
      enrollments = await commitmentRepository.getPendingEnrollments();
    } else if (status === 'active') {
      enrollments = await commitmentRepository.getActiveEnrollments();
    } else {
      // Get all enrollments
      const pending = await commitmentRepository.getPendingEnrollments();
      const active = await commitmentRepository.getActiveEnrollments();
      enrollments = [...pending, ...active];
    }
    
    res.json({
      success: true,
      data: enrollments
    });
    
  } catch (error) {
    logger.error('Error getting enrollments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get commitment enrollments'
    });
  }
});

/**
 * Create new commitment enrollment for a shop
 */
router.post('/enrollments', async (req: Request, res: Response) => {
  try {
    const {
      shopId,
      monthlyAmount = 500,
      termMonths = 6,
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
    
    // Check if shop already has active enrollment
    const existingEnrollment = await commitmentRepository.getActiveEnrollmentByShopId(shopId);
    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        error: 'Shop already has an active commitment enrollment'
      });
    }
    
    // Check if shop can renew (completed previous commitment)
    const canRenew = await commitmentRepository.canShopRenewCommitment(shopId);
    if (!canRenew) {
      return res.status(400).json({
        success: false,
        error: 'Shop cannot create new enrollment while current one is active'
      });
    }
    
    // Create enrollment
    const enrollment = await commitmentRepository.createEnrollment({
      shopId,
      status: 'pending',
      monthlyAmount,
      termMonths,
      totalCommitment: monthlyAmount * termMonths,
      billingMethod,
      paymentsMade: 0,
      totalPaid: 0,
      notes,
      createdBy: (req as any).admin?.walletAddress
    });
    
    res.json({
      success: true,
      data: enrollment
    });
    
  } catch (error) {
    logger.error('Error creating enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create commitment enrollment'
    });
  }
});

/**
 * Approve pending enrollment
 */
router.post('/enrollments/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { billingReference, nextPaymentDate } = req.body;
    
    const enrollment = await commitmentRepository.getEnrollmentById(parseInt(id));
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found'
      });
    }
    
    if (enrollment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Only pending enrollments can be approved'
      });
    }
    
    // Activate enrollment
    const updated = await commitmentRepository.updateEnrollmentStatus(
      parseInt(id),
      'active',
      {
        activatedAt: new Date()
      }
    );
    
    // Update shop operational status
    await shopRepository.updateShop(enrollment.shopId, {
      commitment_enrolled: true,
      operational_status: 'commitment_qualified'
    });
    
    res.json({
      success: true,
      data: updated
    });
    
  } catch (error) {
    logger.error('Error approving enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve enrollment'
    });
  }
});

/**
 * Cancel enrollment
 */
router.post('/enrollments/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const enrollment = await commitmentRepository.getEnrollmentById(parseInt(id));
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found'
      });
    }
    
    const updated = await commitmentRepository.updateEnrollmentStatus(
      parseInt(id),
      'cancelled',
      {
        cancelledAt: new Date(),
        cancellationReason: reason
      }
    );
    
    // Update shop operational status
    await shopRepository.updateShop(enrollment.shopId, {
      commitment_enrolled: false,
      operational_status: 'not_qualified' // May need to check RCG balance
    });
    
    res.json({
      success: true,
      data: updated
    });
    
  } catch (error) {
    logger.error('Error cancelling enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel enrollment'
    });
  }
});

/**
 * Record payment for enrollment
 */
router.post('/enrollments/:id/payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, paymentDate } = req.body;
    
    await commitmentRepository.recordPayment(
      parseInt(id),
      amount,
      paymentDate ? new Date(paymentDate) : new Date()
    );
    
    res.json({
      success: true,
      message: 'Payment recorded successfully'
    });
    
  } catch (error) {
    logger.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record payment'
    });
  }
});

/**
 * Get overdue payments
 */
router.get('/overdue', async (req: Request, res: Response) => {
  try {
    const overdue = await commitmentRepository.getOverduePayments();
    
    res.json({
      success: true,
      data: overdue
    });
    
  } catch (error) {
    logger.error('Error getting overdue payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get overdue payments'
    });
  }
});

export default router;