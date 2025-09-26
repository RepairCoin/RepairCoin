import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import { shopRepository } from '../../../repositories';
import { DatabaseService } from '../../../services/DatabaseService';

const router = Router();

/**
 * Auto-complete old pending purchases
 * This runs as a scheduled job or can be triggered by admin
 */
router.post('/auto-complete-old-purchases', asyncHandler(async (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance();
    
    // Find purchases that have been pending for more than 30 minutes
    // If Stripe shows payment succeeded but webhook failed, these should be completed
    const oldPendingPurchases = await db.query(`
      UPDATE shop_rcn_purchases
      SET 
        status = 'completed',
        completed_at = NOW(),
        payment_reference = COALESCE(payment_reference, 'AUTO_COMPLETE_' || EXTRACT(EPOCH FROM NOW())::TEXT)
      WHERE 
        status = 'pending'
        AND created_at < NOW() - INTERVAL '30 minutes'
        AND payment_method = 'credit_card'
      RETURNING id, shop_id, amount, created_at
    `);
    
    const completedCount = oldPendingPurchases.rowCount || 0;
    
    if (completedCount > 0) {
      logger.info('Auto-completed old pending purchases', {
        count: completedCount,
        purchases: oldPendingPurchases.rows
      });
      
      // Update shop balances for each completed purchase
      for (const purchase of oldPendingPurchases.rows) {
        logger.info('Auto-completed purchase', {
          purchaseId: purchase.id,
          shopId: purchase.shop_id,
          amount: purchase.amount,
          ageMinutes: Math.floor((Date.now() - new Date(purchase.created_at).getTime()) / 60000)
        });
        
        // Update shop's purchased_rcn_balance
        await db.query(`
          UPDATE shops
          SET 
            purchased_rcn_balance = COALESCE(purchased_rcn_balance, 0) + $1,
            total_rcn_purchased = COALESCE(total_rcn_purchased, 0) + $1
          WHERE shop_id = $2
        `, [purchase.amount, purchase.shop_id]);
      }
    }
    
    res.json({
      success: true,
      message: `Auto-completed ${completedCount} old pending purchases`,
      data: {
        completedCount,
        purchases: oldPendingPurchases.rows
      }
    });
    
  } catch (error) {
    logger.error('Error auto-completing purchases:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to auto-complete purchases'
    });
  }
}));

/**
 * Get pending purchase statistics
 */
router.get('/pending-stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance();
    
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_pending,
        COUNT(CASE WHEN created_at < NOW() - INTERVAL '30 minutes' THEN 1 END) as old_pending,
        COUNT(CASE WHEN created_at < NOW() - INTERVAL '1 hour' THEN 1 END) as very_old_pending,
        SUM(amount) as total_amount_pending,
        MIN(created_at) as oldest_pending_date
      FROM shop_rcn_purchases
      WHERE status = 'pending'
    `);
    
    res.json({
      success: true,
      data: stats.rows[0]
    });
    
  } catch (error) {
    logger.error('Error getting pending stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending statistics'
    });
  }
}));

export default router;