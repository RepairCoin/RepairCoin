import { Router, Request, Response } from 'express';
import { CommitmentRepository } from '../../../repositories/CommitmentRepository';
import { DatabaseService } from '../../../services/DatabaseService';
import { logger } from '../../../utils/logger';
import { authMiddleware, requireAdmin } from '../../../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authMiddleware, requireAdmin);

/**
 * @swagger
 * /api/admin/commitments:
 *   get:
 *     summary: Get all commitment subscriptions
 *     tags: [Admin - Commitments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, active, cancelled, completed, defaulted]
 *         description: Filter by status (default all)
 *     responses:
 *       200:
 *         description: List of commitment subscriptions
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/', async (req: Request, res: Response) => {
  // Commitment system has been deprecated and replaced with Stripe subscriptions
  // Return empty array for backward compatibility
  logger.info('Commitment enrollments endpoint called - returning empty (system deprecated)');
  
  res.json({
    success: true,
    data: [],
    message: 'Commitment system has been replaced with Stripe subscriptions. Use /api/admin/shops endpoint to view subscription status.'
  });
});

// Deprecated endpoint - commitment system replaced with Stripe subscriptions
router.post('/:enrollmentId/activate', async (req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'Commitment system has been deprecated. Please use Stripe subscription system instead.'
  });
});

// Export router
export default router;

/* Legacy documentation kept for reference:
 * @swagger
 * /api/admin/commitments/{enrollmentId}/activate:
 *   post:
 *     summary: Activate a pending commitment subscription
 *     tags: [Admin - Commitments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Commitment enrollment ID
 *     responses:
 *       200:
 *         description: Subscription activated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Enrollment not found
 */
router.post('/:enrollmentId/activate', async (req: Request, res: Response) => {
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

    if (enrollment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot activate enrollment with status: ${enrollment.status}`
      });
    }

    const activated = await commitmentRepo.updateEnrollmentStatus(
      enrollmentId,
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
      [enrollment.shopId]
    );

    logger.info('Commitment subscription activated by admin', {
      enrollmentId,
      shopId: enrollment.shopId,
      adminId: req.user?.address
    });

    res.json({
      success: true,
      data: activated
    });

  } catch (error) {
    logger.error('Failed to activate commitment enrollment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      enrollmentId: req.params.enrollmentId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to activate enrollment'
    });
  }
});

/**
 * @swagger
 * /api/admin/commitments/{enrollmentId}/record-payment:
 *   post:
 *     summary: Record a payment for a commitment subscription
 *     tags: [Admin - Commitments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Commitment enrollment ID
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
 *                 description: Payment amount
 *               paymentDate:
 *                 type: string
 *                 format: date
 *                 description: Payment date (defaults to today)
 *               notes:
 *                 type: string
 *                 description: Payment notes
 *     responses:
 *       200:
 *         description: Payment recorded
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Enrollment not found
 */
router.post('/:enrollmentId/record-payment', async (req: Request, res: Response) => {
  try {
    const enrollmentId = parseInt(req.params.enrollmentId);
    const { amount, paymentDate, notes } = req.body;
    
    if (isNaN(enrollmentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid enrollment ID'
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
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

    if (enrollment.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Cannot record payment for enrollment with status: ${enrollment.status}`
      });
    }

    await commitmentRepo.recordPayment(
      enrollmentId,
      amount,
      paymentDate ? new Date(paymentDate) : new Date()
    );

    // Get updated enrollment
    const updatedEnrollment = await commitmentRepo.getEnrollmentById(enrollmentId);

    // Log payment in transaction history
    if (notes) {
      await DatabaseService.getInstance().getPool().query(
        `INSERT INTO webhook_events (event_type, shop_id, payload, status)
         VALUES ('commitment_payment', $1, $2, 'processed')`,
        [enrollment.shopId, JSON.stringify({ amount, notes, recordedBy: req.user?.address })]
      );
    }

    logger.info('Commitment payment recorded by admin', {
      enrollmentId,
      shopId: enrollment.shopId,
      amount,
      adminId: req.user?.address
    });

    res.json({
      success: true,
      data: {
        enrollment: updatedEnrollment,
        message: `Payment of $${amount} recorded successfully`
      }
    });

  } catch (error) {
    logger.error('Failed to record commitment payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      enrollmentId: req.params.enrollmentId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to record payment'
    });
  }
});

/**
 * @swagger
 * /api/admin/commitments/overdue:
 *   get:
 *     summary: Get shops with overdue commitment payments
 *     tags: [Admin - Commitments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of overdue enrollments
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/overdue', async (req: Request, res: Response) => {
  try {
    const commitmentRepo = new CommitmentRepository();

    const overdueEnrollments = await commitmentRepo.getOverduePayments();

    // Add shop details
    const enrichedData = await Promise.all(
      overdueEnrollments.map(async (enrollment) => {
        const shopResult = await DatabaseService.getInstance().getPool().query(
          'SELECT company_name, email, phone_number FROM shops WHERE shop_id = $1',
          [enrollment.shopId]
        );
        
        return {
          ...enrollment,
          shop: shopResult.rows[0] || null,
          daysOverdue: enrollment.nextPaymentDate 
            ? Math.floor((Date.now() - new Date(enrollment.nextPaymentDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0
        };
      })
    );

    res.json({
      success: true,
      data: enrichedData
    });

  } catch (error) {
    logger.error('Failed to get overdue payments', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get overdue payments'
    });
  }
});

/**
 * @swagger
 * /api/admin/commitments/{enrollmentId}/cancel:
 *   post:
 *     summary: Cancel a commitment subscription (admin)
 *     tags: [Admin - Commitments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Commitment enrollment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Cancellation reason
 *     responses:
 *       200:
 *         description: Subscription cancelled
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Enrollment not found
 */
router.post('/:enrollmentId/cancel', async (req: Request, res: Response) => {
  try {
    const enrollmentId = parseInt(req.params.enrollmentId);
    const { reason } = req.body;
    
    if (isNaN(enrollmentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid enrollment ID'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Cancellation reason is required'
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

    if (enrollment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Enrollment is already cancelled'
      });
    }

    const cancelled = await commitmentRepo.updateEnrollmentStatus(
      enrollmentId,
      'cancelled',
      {
        cancelledAt: new Date(),
        cancellationReason: `Admin: ${reason}`
      }
    );

    // Update shop operational status
    await DatabaseService.getInstance().getPool().query(
      `UPDATE shops 
       SET commitment_enrolled = false,
           operational_status = CASE 
             WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
             ELSE 'not_qualified'
           END
       WHERE shop_id = $1`,
      [enrollment.shopId]
    );

    logger.info('Commitment subscription cancelled by admin', {
      enrollmentId,
      shopId: enrollment.shopId,
      reason,
      adminId: req.user?.address
    });

    res.json({
      success: true,
      data: cancelled
    });

  } catch (error) {
    logger.error('Failed to cancel commitment enrollment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      enrollmentId: req.params.enrollmentId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to cancel enrollment'
    });
  }
});
*/

// Router already exported above