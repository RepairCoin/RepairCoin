import { Router, Request, Response } from 'express';
import { SubscriptionService } from '../../../services/SubscriptionService';
import { getStripeService } from '../../../services/StripeService';
import { getSubscriptionEnforcementService } from '../../../services/SubscriptionEnforcementService';
import { ShopRepository } from '../../../repositories/ShopRepository';
import { DatabaseService } from '../../../services/DatabaseService';
import { logger } from '../../../utils/logger';
import { NotificationService } from '../../notification/services/NotificationService';

const router = Router();
const subscriptionService = new SubscriptionService();
const stripeService = getStripeService();
const shopRepository = new ShopRepository();
const db = DatabaseService.getInstance();
const notificationService = new NotificationService();

// Get all subscriptions for admin view (now using shop_subscriptions)
router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      WITH latest_stripe_subs AS (
        SELECT DISTINCT ON (shop_id)
          shop_id,
          current_period_end
        FROM stripe_subscriptions
        ORDER BY shop_id, created_at DESC
      )
      SELECT
        subs.*,
        s.name as shop_name,
        s.email as shop_email,
        s.wallet_address,
        s.phone,
        ss.current_period_end as stripe_period_end
      FROM shop_subscriptions subs
      JOIN shops s ON s.shop_id = subs.shop_id
      LEFT JOIN latest_stripe_subs ss ON s.shop_id = ss.shop_id
    `;

    const params: any[] = [];
    if (status) {
      query += ' WHERE subs.status = $1';
      params.push(status);
    }

    query += ' ORDER BY subs.enrolled_at DESC';
    query += ` LIMIT ${Number(limit)} OFFSET ${offset}`;

    const result = await db.query(query, params);

    // Transform the data to match frontend expectations
    const transformedRows = result.rows.map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      shopName: row.shop_name || 'Unknown Shop',
      email: row.shop_email || '',
      status: row.status || 'unknown',
      subscriptionType: row.subscription_type,
      billingMethod: row.billing_method,
      billingReference: row.billing_reference,
      monthlyAmount: parseFloat(row.monthly_amount || 500),
      paymentsMade: row.payments_made || 0,
      totalPaid: parseFloat(row.total_paid || 0),
      nextPaymentDate: row.next_payment_date,
      lastPaymentDate: row.last_payment_date,
      stripePeriodEnd: row.stripe_period_end, // Stripe's current_period_end for accurate subscription end date
      isActive: row.is_active,
      enrolledAt: row.enrolled_at,
      activatedAt: row.activated_at,
      cancelledAt: row.cancelled_at,
      pausedAt: row.paused_at,
      resumedAt: row.resumed_at,
      cancellationReason: row.cancellation_reason,
      pauseReason: row.pause_reason,
      notes: row.notes,
      createdBy: row.created_by,
      daysOverdue: row.next_payment_date && new Date(row.next_payment_date) < new Date() && row.status === 'active' ?
        Math.floor((Date.now() - new Date(row.next_payment_date).getTime()) / (1000 * 60 * 60 * 24)) : 0
    }));

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM shop_subscriptions subs
    `;
    if (status) {
      countQuery += ' WHERE subs.status = $1';
    }

    const countResult = await db.query(countQuery, status ? [status] : []);
    const total = parseInt(countResult.rows[0].total);

    // Return subscriptions array directly in data for frontend compatibility
    res.json({
      success: true,
      data: transformedRows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscriptions'
    });
  }
});

// Get subscription statistics (now using shop_subscriptions)
router.get('/subscriptions/stats', async (req: Request, res: Response) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as canceled_count,
        COUNT(*) FILTER (WHERE status = 'paused') as paused_count,
        COUNT(*) FILTER (WHERE status = 'defaulted') as defaulted_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_amount ELSE 0 END), 0) as monthly_revenue,
        COALESCE(SUM(total_paid), 0) as total_revenue
      FROM shop_subscriptions
    `;

    const result = await db.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        active: parseInt(stats.active_count),
        canceled: parseInt(stats.canceled_count),
        paused: parseInt(stats.paused_count),
        defaulted: parseInt(stats.defaulted_count),
        pending: parseInt(stats.pending_count),
        total: parseInt(stats.total_count),
        monthlyRevenue: parseFloat(stats.monthly_revenue),
        yearlyRevenue: parseFloat(stats.monthly_revenue) * 12,
        totalRevenue: parseFloat(stats.total_revenue)
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription statistics'
    });
  }
});

// Get subscription details
router.get('/subscriptions/:subscriptionId', async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;

    const query = `
      SELECT 
        ss.*,
        s.name as shop_name,
        s.email as shop_email,
        s.wallet_address,
        s.phone,
        sc.email as stripe_email,
        sc.name as stripe_name
      FROM stripe_subscriptions ss
      JOIN shops s ON s.shop_id = ss.shop_id
      LEFT JOIN stripe_customers sc ON sc.stripe_customer_id = ss.stripe_customer_id
      WHERE ss.stripe_subscription_id = $1
    `;

    const result = await db.query(query, [subscriptionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Get payment history
    const paymentsQuery = `
      SELECT * FROM stripe_payments 
      WHERE stripe_subscription_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const payments = await db.query(paymentsQuery, [subscriptionId]);

    res.json({
      success: true,
      data: {
        subscription: result.rows[0],
        payments: payments.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription details'
    });
  }
});

// Cancel a subscription
router.post('/subscriptions/:subscriptionId/cancel', async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { immediately = false, reason } = req.body;

    // Get subscription from shop_subscriptions by ID
    const subQuery = await db.query(
      'SELECT billing_reference, shop_id, status FROM shop_subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (subQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    const { billing_reference: stripeSubscriptionId, shop_id: shopId, status } = subQuery.rows[0];

    if (!stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'No Stripe subscription reference found'
      });
    }

    logger.info('Canceling subscription', { subscriptionId, stripeSubscriptionId, shopId, immediately });

    // Cancel the subscription via Stripe directly (avoids pool exhaustion)
    await stripeService.cancelSubscription(stripeSubscriptionId, immediately);

    // Update stripe_subscriptions table
    await db.query(
      `UPDATE stripe_subscriptions
       SET status = $1, cancel_at_period_end = $2, canceled_at = $3, updated_at = CURRENT_TIMESTAMP
       WHERE stripe_subscription_id = $4`,
      [immediately ? 'canceled' : 'active', !immediately, immediately ? new Date() : null, stripeSubscriptionId]
    );

    // Update shop_subscriptions
    await db.query(
      `UPDATE shop_subscriptions
       SET status = 'cancelled', is_active = false, cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = $1
       WHERE id = $2`,
      [reason || 'Cancelled by admin', subscriptionId]
    );

    // Get shop wallet address for notification
    const shopQuery = await db.query(
      'SELECT wallet_address FROM shops WHERE shop_id = $1',
      [shopId]
    );

    if (shopQuery.rows.length > 0 && shopQuery.rows[0].wallet_address) {
      try {
        await notificationService.createSubscriptionCancelledNotification(
          shopQuery.rows[0].wallet_address,
          reason || 'Cancelled by admin'
        );
        logger.info('Subscription cancellation notification sent', { shopId, subscriptionId });
      } catch (notifError) {
        logger.error('Failed to send cancellation notification:', notifError);
      }
    }

    res.json({
      success: true,
      message: immediately ? 'Subscription canceled immediately' : 'Subscription will be canceled at end of billing period'
    });
  } catch (error) {
    logger.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription'
    });
  }
});

// Pause a subscription
router.post('/subscriptions/:subscriptionId/pause', async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;

    // Get subscription from shop_subscriptions by ID
    const subQuery = await db.query(
      'SELECT billing_reference, shop_id, status FROM shop_subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (subQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    const { billing_reference: stripeSubscriptionId, shop_id: shopId, status } = subQuery.rows[0];

    if (!stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'No Stripe subscription reference found'
      });
    }

    // Check if subscription is already paused or cancelled
    if (status === 'paused') {
      return res.status(400).json({
        success: false,
        error: 'Subscription is already paused'
      });
    }

    if (status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot pause a cancelled subscription. Please create a new subscription instead.'
      });
    }

    // Check actual Stripe status before attempting to pause
    try {
      const stripeSubscription = await stripeService.getSubscription(stripeSubscriptionId);

      if (stripeSubscription.status === 'canceled') {
        // Clean up orphaned database entries
        logger.info('Subscription is fully canceled in Stripe during pause attempt, cleaning up database entries', {
          subscriptionId,
          stripeSubscriptionId,
          shopId
        });

        await db.query('DELETE FROM shop_subscriptions WHERE id = $1', [subscriptionId]);
        await db.query('DELETE FROM stripe_subscriptions WHERE stripe_subscription_id = $1', [stripeSubscriptionId]);

        return res.status(400).json({
          success: false,
          error: 'This subscription has been fully canceled in Stripe. The orphaned database entries have been cleaned up. Please create a new subscription instead.',
          cleaned: true
        });
      }

      if (stripeSubscription.pause_collection) {
        // Already paused in Stripe, update our database
        await db.query(
          `UPDATE shop_subscriptions
           SET status = 'paused', is_active = false, paused_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [subscriptionId]
        );

        return res.json({
          success: true,
          message: 'Subscription was already paused in Stripe. Database updated.'
        });
      }
    } catch (stripeCheckError) {
      const errorMessage = stripeCheckError instanceof Error ? stripeCheckError.message : 'Unknown error';

      // Check if subscription doesn't exist in Stripe
      if (errorMessage.includes('No such subscription') || errorMessage.includes('resource_missing')) {
        logger.info('Subscription not found in Stripe during pause attempt, cleaning up orphaned database entries', {
          subscriptionId,
          stripeSubscriptionId,
          shopId,
          error: errorMessage
        });

        await db.query('DELETE FROM shop_subscriptions WHERE id = $1', [subscriptionId]);
        await db.query('DELETE FROM stripe_subscriptions WHERE stripe_subscription_id = $1', [stripeSubscriptionId]);

        return res.status(400).json({
          success: false,
          error: 'This subscription no longer exists in Stripe. The orphaned database entries have been cleaned up. Please create a new subscription.',
          cleaned: true
        });
      }

      logger.error('Failed to check Stripe subscription status before pause', {
        subscriptionId: stripeSubscriptionId,
        error: errorMessage
      });
      // Continue with pause attempt - Stripe will return appropriate error
    }

    logger.info('Pausing subscription', { subscriptionId, stripeSubscriptionId, shopId });

    // Pause the subscription via Stripe
    await subscriptionService.pauseSubscription(stripeSubscriptionId);

    // Update shop_subscriptions
    await db.query(
      `UPDATE shop_subscriptions
       SET status = 'paused', is_active = false, paused_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [subscriptionId]
    );

    // Get shop wallet address for notification
    const shopQuery = await db.query(
      'SELECT wallet_address FROM shops WHERE shop_id = $1',
      [shopId]
    );

    if (shopQuery.rows.length > 0 && shopQuery.rows[0].wallet_address) {
      try {
        await notificationService.createSubscriptionPausedNotification(
          shopQuery.rows[0].wallet_address,
          'Paused by admin'
        );
        logger.info('Subscription pause notification sent', { shopId, subscriptionId });
      } catch (notifError) {
        logger.error('Failed to send pause notification:', notifError);
      }
    }

    res.json({
      success: true,
      message: 'Subscription paused successfully'
    });
  } catch (error) {
    logger.error('Error pausing subscription:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause subscription'
    });
  }
});

// Resume a paused subscription
router.post('/subscriptions/:subscriptionId/resume', async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;

    logger.info('Attempting to resume subscription', { subscriptionId });

    // Get subscription from shop_subscriptions by ID
    const subQuery = await db.query(
      'SELECT billing_reference, status, shop_id FROM shop_subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (subQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    const { billing_reference: stripeSubscriptionId, status, shop_id: shopId } = subQuery.rows[0];

    if (!stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'No Stripe subscription reference found'
      });
    }

    logger.info('Found subscription in database', {
      stripeSubscriptionId,
      currentStatus: status,
      shopId
    });

    // Check if subscription is cancelled - cannot resume cancelled subscriptions
    if (status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot resume a cancelled subscription. Please create a new subscription instead.'
      });
    }

    // Check if subscription is already active
    if (status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Subscription is already active.'
      });
    }

    // Check actual Stripe status before attempting to resume
    try {
      const stripeSubscription = await stripeService.getSubscription(stripeSubscriptionId);

      if (stripeSubscription.status === 'canceled') {
        // Clean up orphaned database entries
        logger.info('Subscription is fully canceled in Stripe during resume attempt, cleaning up database entries', {
          subscriptionId,
          stripeSubscriptionId,
          shopId
        });

        await db.query('DELETE FROM shop_subscriptions WHERE id = $1', [subscriptionId]);
        await db.query('DELETE FROM stripe_subscriptions WHERE stripe_subscription_id = $1', [stripeSubscriptionId]);

        return res.status(400).json({
          success: false,
          error: 'This subscription has been fully canceled in Stripe. The orphaned database entries have been cleaned up. Please create a new subscription instead.',
          cleaned: true
        });
      }

      // If subscription is already active in Stripe (no pause_collection)
      if (stripeSubscription.status === 'active' && !stripeSubscription.pause_collection) {
        // Update our database to match Stripe
        await db.query(
          `UPDATE shop_subscriptions
           SET status = 'active', is_active = true, resumed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [subscriptionId]
        );

        // Also update stripe_subscriptions if needed
        await db.query(
          `UPDATE stripe_subscriptions
           SET status = 'active', updated_at = CURRENT_TIMESTAMP
           WHERE stripe_subscription_id = $1`,
          [stripeSubscriptionId]
        );

        return res.json({
          success: true,
          message: 'Subscription is already active in Stripe. Database updated.'
        });
      }
    } catch (stripeCheckError) {
      const errorMessage = stripeCheckError instanceof Error ? stripeCheckError.message : 'Unknown error';

      // Check if subscription doesn't exist in Stripe
      if (errorMessage.includes('No such subscription') || errorMessage.includes('resource_missing')) {
        logger.info('Subscription not found in Stripe during resume attempt, cleaning up orphaned database entries', {
          subscriptionId,
          stripeSubscriptionId,
          shopId,
          error: errorMessage
        });

        await db.query('DELETE FROM shop_subscriptions WHERE id = $1', [subscriptionId]);
        await db.query('DELETE FROM stripe_subscriptions WHERE stripe_subscription_id = $1', [stripeSubscriptionId]);

        return res.status(400).json({
          success: false,
          error: 'This subscription no longer exists in Stripe. The orphaned database entries have been cleaned up. Please create a new subscription.',
          cleaned: true
        });
      }

      logger.error('Failed to check Stripe subscription status before resume', {
        subscriptionId: stripeSubscriptionId,
        error: errorMessage
      });
      // Continue with resume attempt - let the actual resume call handle errors
    }

    try {
      // Resume the subscription via Stripe
      const result = await subscriptionService.resumeSubscription(stripeSubscriptionId);

      // Update shop_subscriptions
      await db.query(
        `UPDATE shop_subscriptions
         SET status = 'active', is_active = true, resumed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [subscriptionId]
      );

      // Get shop wallet address for notification
      const shopQuery = await db.query(
        'SELECT wallet_address FROM shops WHERE shop_id = $1',
        [shopId]
      );

      if (shopQuery.rows.length > 0 && shopQuery.rows[0].wallet_address) {
        try {
          await notificationService.createSubscriptionResumedNotification(
            shopQuery.rows[0].wallet_address
          );
          logger.info('Subscription resume notification sent', { shopId, subscriptionId });
        } catch (notifError) {
          logger.error('Failed to send resume notification:', notifError);
        }
      }

      logger.info('Subscription resumed successfully', {
        subscriptionId: stripeSubscriptionId,
        newStatus: result.status
      });

      res.json({
        success: true,
        message: 'Subscription resumed successfully',
        data: result
      });
    } catch (stripeError) {
      // Handle specific Stripe errors
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown error';

      logger.error('Stripe resume error', {
        subscriptionId: stripeSubscriptionId,
        error: errorMessage,
        stack: stripeError instanceof Error ? stripeError.stack : undefined
      });

      // If Stripe says it's not paused, update our database
      if (errorMessage.includes('not paused') || errorMessage.includes('already active')) {
        await db.query(
          `UPDATE shop_subscriptions
           SET status = 'active', is_active = true, resumed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [subscriptionId]
        );

        return res.json({
          success: true,
          message: 'Subscription was already active in Stripe. Database updated.',
          data: { status: 'active' }
        });
      }

      throw stripeError;
    }
  } catch (error) {
    logger.error('Error resuming subscription:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume subscription',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
});

// Sync subscription status from Stripe
router.post('/subscriptions/:subscriptionId/sync', async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;

    logger.info('Attempting to sync subscription from Stripe', { subscriptionId });

    // Get subscription from shop_subscriptions by ID
    const subQuery = await db.query(
      'SELECT billing_reference, status, shop_id FROM shop_subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (subQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    const { billing_reference: stripeSubscriptionId, status: currentStatus, shop_id: shopId } = subQuery.rows[0];

    if (!stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'No Stripe subscription reference found'
      });
    }

    logger.info('Syncing subscription from Stripe', {
      subscriptionId,
      stripeSubscriptionId,
      currentStatus,
      shopId
    });

    // First check if subscription exists and its status in Stripe
    let stripeSubscription;
    try {
      stripeSubscription = await stripeService.getSubscription(stripeSubscriptionId);
    } catch (stripeError) {
      // Subscription not found in Stripe - clean up orphaned database entries
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown error';

      if (errorMessage.includes('No such subscription') || errorMessage.includes('resource_missing')) {
        logger.info('Subscription not found in Stripe during sync, cleaning up orphaned database entries', {
          subscriptionId,
          stripeSubscriptionId,
          shopId,
          error: errorMessage
        });

        // Delete from shop_subscriptions
        await db.query('DELETE FROM shop_subscriptions WHERE id = $1', [subscriptionId]);

        // Delete from stripe_subscriptions
        await db.query('DELETE FROM stripe_subscriptions WHERE stripe_subscription_id = $1', [stripeSubscriptionId]);

        logger.info('Cleaned up orphaned subscription entries from database during sync', {
          subscriptionId,
          stripeSubscriptionId
        });

        return res.json({
          success: true,
          message: 'Subscription no longer exists in Stripe. Orphaned database entries have been cleaned up.',
          cleaned: true,
          data: {
            oldStatus: currentStatus,
            newStatus: 'deleted'
          }
        });
      }

      throw stripeError;
    }

    // If subscription is fully canceled in Stripe, clean up the database entries
    if (stripeSubscription.status === 'canceled') {
      logger.info('Subscription is fully canceled in Stripe during sync, cleaning up database entries', {
        subscriptionId,
        stripeSubscriptionId,
        shopId
      });

      // Delete from shop_subscriptions
      await db.query('DELETE FROM shop_subscriptions WHERE id = $1', [subscriptionId]);

      // Delete from stripe_subscriptions
      await db.query('DELETE FROM stripe_subscriptions WHERE stripe_subscription_id = $1', [stripeSubscriptionId]);

      logger.info('Cleaned up fully canceled subscription entries from database during sync', {
        subscriptionId,
        stripeSubscriptionId
      });

      return res.json({
        success: true,
        message: 'Subscription was fully canceled in Stripe. Database entries have been cleaned up.',
        cleaned: true,
        data: {
          oldStatus: currentStatus,
          newStatus: 'deleted'
        }
      });
    }

    // Sync from Stripe - this will update stripe_subscriptions table
    const syncedSubscription = await subscriptionService.syncSubscriptionFromStripe(stripeSubscriptionId);

    // Also update shop_subscriptions table manually
    const newStatus = syncedSubscription.status === 'active' ? 'active' :
                     syncedSubscription.status === 'paused' ? 'paused' :
                     syncedSubscription.status === 'canceled' ? 'cancelled' : currentStatus;

    await db.query(
      `UPDATE shop_subscriptions
       SET status = $1, is_active = $2
       WHERE id = $3`,
      [newStatus, syncedSubscription.status === 'active', subscriptionId]
    );

    logger.info('Subscription synced successfully', {
      subscriptionId: stripeSubscriptionId,
      oldStatus: currentStatus,
      newStatus: newStatus
    });

    res.json({
      success: true,
      message: 'Subscription synced successfully from Stripe',
      data: {
        oldStatus: currentStatus,
        newStatus: newStatus,
        subscription: syncedSubscription
      }
    });
  } catch (error) {
    logger.error('Error syncing subscription:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync subscription',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
});

// Reactivate a canceled subscription (undo cancel_at_period_end)
router.post('/subscriptions/:subscriptionId/reactivate', async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;

    logger.info('Attempting to reactivate subscription', { subscriptionId });

    // Get subscription from shop_subscriptions by ID
    const subQuery = await db.query(
      'SELECT billing_reference, status, shop_id FROM shop_subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (subQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    const { billing_reference: stripeSubscriptionId, status, shop_id: shopId } = subQuery.rows[0];

    if (!stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'No Stripe subscription reference found'
      });
    }

    // Only allow reactivation of cancelled subscriptions
    if (status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        error: `Cannot reactivate a subscription with status: ${status}. Only cancelled subscriptions can be reactivated.`
      });
    }

    // Check the actual Stripe subscription status
    let stripeSubscription;
    try {
      stripeSubscription = await stripeService.getSubscription(stripeSubscriptionId);
    } catch (stripeError) {
      // Subscription not found in Stripe - clean up orphaned database entries
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown error';

      if (errorMessage.includes('No such subscription') || errorMessage.includes('resource_missing')) {
        logger.info('Subscription not found in Stripe, cleaning up orphaned database entries', {
          subscriptionId,
          stripeSubscriptionId,
          shopId,
          error: errorMessage
        });

        // Delete from shop_subscriptions
        await db.query('DELETE FROM shop_subscriptions WHERE id = $1', [subscriptionId]);

        // Delete from stripe_subscriptions
        await db.query('DELETE FROM stripe_subscriptions WHERE stripe_subscription_id = $1', [stripeSubscriptionId]);

        logger.info('Cleaned up orphaned subscription entries from database', {
          subscriptionId,
          stripeSubscriptionId
        });

        return res.status(400).json({
          success: false,
          error: 'This subscription no longer exists in Stripe. The orphaned database entries have been cleaned up. Please create a new subscription.',
          cleaned: true
        });
      }

      // For other errors, throw to be handled by outer catch
      throw stripeError;
    }

    // If subscription is fully canceled in Stripe, we cannot reactivate
    // Clean up the database entries since they're orphaned
    if (stripeSubscription.status === 'canceled') {
      logger.info('Subscription is fully canceled in Stripe, cleaning up database entries', {
        subscriptionId,
        stripeSubscriptionId,
        shopId
      });

      // Delete from shop_subscriptions
      await db.query('DELETE FROM shop_subscriptions WHERE id = $1', [subscriptionId]);

      // Delete from stripe_subscriptions
      await db.query('DELETE FROM stripe_subscriptions WHERE stripe_subscription_id = $1', [stripeSubscriptionId]);

      logger.info('Cleaned up orphaned subscription entries from database', {
        subscriptionId,
        stripeSubscriptionId
      });

      return res.status(400).json({
        success: false,
        error: 'This subscription has been fully canceled in Stripe and cannot be reactivated. The orphaned database entries have been cleaned up. Please create a new subscription.',
        cleaned: true
      });
    }

    // If subscription has cancel_at_period_end set, we can unset it to reactivate
    if (stripeSubscription.cancel_at_period_end) {
      // Remove the cancel_at_period_end flag in Stripe
      await stripeService.getStripe().subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: false
      });

      logger.info('Removed cancel_at_period_end flag in Stripe', { stripeSubscriptionId });
    }

    // Update stripe_subscriptions table
    await db.query(
      `UPDATE stripe_subscriptions
       SET status = 'active', cancel_at_period_end = false, canceled_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE stripe_subscription_id = $1`,
      [stripeSubscriptionId]
    );

    // Update shop_subscriptions table
    await db.query(
      `UPDATE shop_subscriptions
       SET status = 'active', is_active = true, cancelled_at = NULL, cancellation_reason = NULL, activated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [subscriptionId]
    );

    // Get shop wallet address for notification
    const shopQuery = await db.query(
      'SELECT wallet_address FROM shops WHERE shop_id = $1',
      [shopId]
    );

    if (shopQuery.rows.length > 0 && shopQuery.rows[0].wallet_address) {
      try {
        await notificationService.createSubscriptionReactivatedNotification(
          shopQuery.rows[0].wallet_address
        );
        logger.info('Subscription reactivation notification sent', { shopId, subscriptionId });
      } catch (notifError) {
        logger.error('Failed to send reactivation notification:', notifError);
      }
    }

    logger.info('Subscription reactivated successfully', {
      subscriptionId,
      stripeSubscriptionId,
      shopId
    });

    res.json({
      success: true,
      message: 'Subscription reactivated successfully'
    });
  } catch (error) {
    logger.error('Error reactivating subscription:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reactivate subscription'
    });
  }
});

// ============================================
// Subscription Enforcement Endpoints
// ============================================

// Get enforcement statistics for admin dashboard
router.get('/subscriptions/enforcement/stats', async (req: Request, res: Response) => {
  try {
    const enforcementService = getSubscriptionEnforcementService();
    const stats = await enforcementService.getEnforcementStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching enforcement stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enforcement statistics'
    });
  }
});

// Get list of overdue subscriptions
router.get('/subscriptions/overdue', async (req: Request, res: Response) => {
  try {
    const enforcementService = getSubscriptionEnforcementService();
    const overdueSubscriptions = await enforcementService.getOverdueSubscriptions();

    res.json({
      success: true,
      data: {
        subscriptions: overdueSubscriptions,
        count: overdueSubscriptions.length
      }
    });
  } catch (error) {
    logger.error('Error fetching overdue subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overdue subscriptions'
    });
  }
});

// Run enforcement manually (admin can trigger the cron job manually)
router.post('/subscriptions/enforcement/run', async (req: Request, res: Response) => {
  try {
    logger.info('Manual enforcement triggered by admin', {
      adminAddress: req.user?.address
    });

    const enforcementService = getSubscriptionEnforcementService();
    const stats = await enforcementService.enforceAllSubscriptions();

    res.json({
      success: true,
      message: 'Enforcement completed successfully',
      data: stats
    });
  } catch (error) {
    logger.error('Error running manual enforcement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run subscription enforcement'
    });
  }
});

// Enforce a specific shop's subscription
router.post('/subscriptions/:shopId/enforce', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;

    logger.info('Manual enforcement for specific shop triggered by admin', {
      shopId,
      adminAddress: req.user?.address
    });

    const enforcementService = getSubscriptionEnforcementService();
    const result = await enforcementService.enforceForShop(shopId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error enforcing shop subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enforce shop subscription'
    });
  }
});

// Get enforcement log for a specific subscription
router.get('/subscriptions/:stripeSubscriptionId/enforcement-log', async (req: Request, res: Response) => {
  try {
    const { stripeSubscriptionId } = req.params;

    const query = `
      SELECT * FROM subscription_enforcement_log
      WHERE stripe_subscription_id = $1
    `;

    const result = await db.query(query, [stripeSubscriptionId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No enforcement log found for this subscription'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching enforcement log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enforcement log'
    });
  }
});

export default router;