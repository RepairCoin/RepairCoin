import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import { shopRepository } from '../../../repositories';
import { DatabaseService } from '../../../services/DatabaseService';
import { getStripeService } from '../../../services/StripeService';
import Stripe from 'stripe';

const router = Router();

/**
 * Auto-complete old pending purchases with Stripe payment verification
 * Only completes purchases that have confirmed successful payments in Stripe
 */
router.post('/auto-complete-old-purchases', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance();
  const stripeService = getStripeService();
  
  // Use database transaction for atomic operations
  await db.query('BEGIN');
  
  try {
    // Find purchases to auto-complete - include payment_reference for Stripe verification
    const pendingPurchases = await db.query(`
      SELECT id, shop_id, amount, created_at, payment_reference, payment_method
      FROM shop_rcn_purchases
      WHERE 
        status = 'pending'
        AND created_at < NOW() - INTERVAL '30 minutes'
        AND payment_method = 'credit_card'
        AND payment_reference IS NOT NULL
      FOR UPDATE
    `);
    
    const purchasesToVerify = pendingPurchases.rows;
    let completedCount = 0;
    let skippedCount = 0;
    const failedUpdates: any[] = [];
    const verificationResults: any[] = [];
    
    // Process each purchase with Stripe verification
    for (const purchase of purchasesToVerify) {
      try {
        let shouldComplete = false;
        let verificationStatus = 'unknown';
        let stripeStatus = 'not_found';
        
        // Verify payment with Stripe based on payment_reference type
        try {
          if (purchase.payment_reference) {
            let stripePayment: any = null;
            
            // Try different Stripe object types based on payment_reference format
            if (purchase.payment_reference.startsWith('pi_')) {
              // Payment Intent
              stripePayment = await stripeService.getStripe().paymentIntents.retrieve(purchase.payment_reference);
              stripeStatus = stripePayment.status;
              shouldComplete = stripePayment.status === 'succeeded';
              verificationStatus = `payment_intent_${stripePayment.status}`;
              
            } else if (purchase.payment_reference.startsWith('in_')) {
              // Invoice
              const invoice = await stripeService.getInvoice(purchase.payment_reference);
              stripeStatus = invoice.status;
              shouldComplete = invoice.status === 'paid';
              verificationStatus = `invoice_${invoice.status}`;
              
            } else if (purchase.payment_reference.startsWith('cs_')) {
              // Checkout Session
              const session = await stripeService.getCheckoutSession(purchase.payment_reference);
              stripeStatus = session.payment_status;
              shouldComplete = session.payment_status === 'paid';
              verificationStatus = `checkout_${session.payment_status}`;
              
            } else if (purchase.payment_reference.startsWith('sub_')) {
              // Subscription - check latest invoice
              const subscription = await stripeService.getSubscription(purchase.payment_reference);
              const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
              stripeStatus = latestInvoice?.status || 'unknown';
              shouldComplete = latestInvoice?.status === 'paid';
              verificationStatus = `subscription_${latestInvoice?.status}`;
              
            } else {
              // Unknown format - skip
              verificationStatus = 'unknown_reference_format';
              shouldComplete = false;
            }
          } else {
            verificationStatus = 'no_payment_reference';
            shouldComplete = false;
          }
          
        } catch (stripeError) {
          logger.warn('Stripe verification failed for purchase', {
            purchaseId: purchase.id,
            paymentReference: purchase.payment_reference,
            stripeError: stripeError.message
          });
          verificationStatus = `stripe_error: ${stripeError.message}`;
          shouldComplete = false;
        }
        
        verificationResults.push({
          purchaseId: purchase.id,
          paymentReference: purchase.payment_reference,
          verificationStatus,
          stripeStatus,
          shouldComplete,
          ageMinutes: Math.floor((Date.now() - new Date(purchase.created_at).getTime()) / 60000)
        });
        
        // Only complete if Stripe confirms payment was successful
        if (shouldComplete) {
          // Verify shop still exists before updating
          const shopExists = await db.query(`
            SELECT shop_id FROM shops WHERE shop_id = $1
          `, [purchase.shop_id]);
          
          if (shopExists.rowCount === 0) {
            logger.warn('Shop not found during auto-complete', {
              purchaseId: purchase.id,
              shopId: purchase.shop_id
            });
            failedUpdates.push({
              purchaseId: purchase.id,
              reason: 'Shop not found',
              verificationStatus
            });
            continue;
          }
          
          // Update shop balance first
          await db.query(`
            UPDATE shops
            SET 
              purchased_rcn_balance = COALESCE(purchased_rcn_balance, 0) + $1,
              total_rcn_purchased = COALESCE(total_rcn_purchased, 0) + $1
            WHERE shop_id = $2
          `, [purchase.amount, purchase.shop_id]);
          
          // Mark as completed with verification info
          await db.query(`
            UPDATE shop_rcn_purchases
            SET 
              status = 'completed',
              completed_at = NOW(),
              payment_reference = $2
            WHERE id = $1
          `, [purchase.id, `${purchase.payment_reference}_VERIFIED_${Date.now()}`]);
          
          completedCount++;
          
          logger.info('Auto-completed verified purchase', {
            purchaseId: purchase.id,
            shopId: purchase.shop_id,
            amount: purchase.amount,
            verificationStatus,
            stripeStatus,
            ageMinutes: Math.floor((Date.now() - new Date(purchase.created_at).getTime()) / 60000)
          });
          
        } else {
          // Payment not confirmed in Stripe - leave as pending
          skippedCount++;
          logger.info('Skipped unverified purchase', {
            purchaseId: purchase.id,
            shopId: purchase.shop_id,
            paymentReference: purchase.payment_reference,
            verificationStatus,
            stripeStatus,
            reason: 'Payment not confirmed in Stripe'
          });
        }
        
      } catch (purchaseError) {
        logger.error('Failed to process purchase during auto-complete', {
          purchaseId: purchase.id,
          error: purchaseError
        });
        failedUpdates.push({
          purchaseId: purchase.id,
          reason: purchaseError.message
        });
      }
    }
    
    // Commit the transaction - all or nothing
    await db.query('COMMIT');
    
    logger.info('Auto-completed verified pending purchases', {
      totalAttempted: purchasesToVerify.length,
      completedCount,
      skippedCount,
      failedCount: failedUpdates.length,
      verificationResults,
      failures: failedUpdates
    });
    
    res.json({
      success: true,
      message: `Auto-completed ${completedCount} verified payments. Skipped ${skippedCount} unverified. Failed ${failedUpdates.length}.`,
      data: {
        completedCount,
        skippedCount,
        failedCount: failedUpdates.length,
        totalAttempted: purchasesToVerify.length,
        verificationResults,
        failures: failedUpdates.length > 0 ? failedUpdates : undefined
      }
    });
    
  } catch (error) {
    // Rollback on any error
    await db.query('ROLLBACK');
    
    logger.error('Error auto-completing purchases - transaction rolled back:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to auto-complete purchases - all changes rolled back'
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
        COUNT(CASE WHEN payment_reference IS NULL THEN 1 END) as no_payment_reference,
        COUNT(CASE WHEN payment_reference IS NOT NULL AND created_at < NOW() - INTERVAL '30 minutes' THEN 1 END) as verifiable_old_pending,
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

/**
 * Get detailed pending purchases for admin review with Stripe verification
 */
router.get('/pending-details', asyncHandler(async (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance();
    const stripeService = getStripeService();
    
    const pendingPurchases = await db.query(`
      SELECT id, shop_id, amount, created_at, payment_reference, payment_method,
             EXTRACT(EPOCH FROM (NOW() - created_at))/60 as age_minutes
      FROM shop_rcn_purchases
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 50
    `);
    
    const purchasesWithStripeStatus = [];
    
    for (const purchase of pendingPurchases.rows) {
      let stripeVerification = {
        hasPaymentReference: !!purchase.payment_reference,
        stripeStatus: 'not_checked',
        canAutoComplete: false,
        error: null as string | null
      };
      
      if (purchase.payment_reference && purchase.age_minutes > 5) { // Only check purchases older than 5 minutes
        try {
          if (purchase.payment_reference.startsWith('pi_')) {
            const paymentIntent = await stripeService.getStripe().paymentIntents.retrieve(purchase.payment_reference);
            stripeVerification.stripeStatus = `payment_intent_${paymentIntent.status}`;
            stripeVerification.canAutoComplete = paymentIntent.status === 'succeeded';
          } else if (purchase.payment_reference.startsWith('cs_')) {
            const session = await stripeService.getCheckoutSession(purchase.payment_reference);
            stripeVerification.stripeStatus = `checkout_${session.payment_status}`;
            stripeVerification.canAutoComplete = session.payment_status === 'paid';
          } else if (purchase.payment_reference.startsWith('in_')) {
            const invoice = await stripeService.getInvoice(purchase.payment_reference);
            stripeVerification.stripeStatus = `invoice_${invoice.status}`;
            stripeVerification.canAutoComplete = invoice.status === 'paid';
          } else if (purchase.payment_reference.startsWith('sub_')) {
            const subscription = await stripeService.getSubscription(purchase.payment_reference);
            const latestInvoice = subscription.latest_invoice as any;
            stripeVerification.stripeStatus = `subscription_${latestInvoice?.status || 'unknown'}`;
            stripeVerification.canAutoComplete = latestInvoice?.status === 'paid';
          } else {
            stripeVerification.stripeStatus = 'unknown_reference_format';
          }
        } catch (stripeError: any) {
          stripeVerification.error = stripeError.message;
          stripeVerification.stripeStatus = 'stripe_error';
        }
      }
      
      purchasesWithStripeStatus.push({
        ...purchase,
        stripeVerification
      });
    }
    
    res.json({
      success: true,
      data: {
        purchases: purchasesWithStripeStatus,
        summary: {
          total: purchasesWithStripeStatus.length,
          canAutoComplete: purchasesWithStripeStatus.filter(p => p.stripeVerification.canAutoComplete).length,
          noPaymentReference: purchasesWithStripeStatus.filter(p => !p.stripeVerification.hasPaymentReference).length,
          stripeErrors: purchasesWithStripeStatus.filter(p => p.stripeVerification.error).length
        }
      }
    });
    
  } catch (error) {
    logger.error('Error getting pending details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending purchase details'
    });
  }
}));

export default router;