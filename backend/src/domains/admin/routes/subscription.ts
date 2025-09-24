import { Router, Request, Response } from 'express';
import { SubscriptionService } from '../../../services/SubscriptionService';
import { ShopRepository } from '../../../repositories/ShopRepository';
import { DatabaseService } from '../../../services/DatabaseService';
import { logger } from '../../../utils/logger';

const router = Router();
const subscriptionService = new SubscriptionService();
const shopRepository = new ShopRepository();
const db = DatabaseService.getInstance();

// Get all subscriptions for admin view
router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        ss.*,
        s.name as shop_name,
        s.email as shop_email,
        s.wallet_address,
        s.phone,
        sc.email as stripe_email
      FROM stripe_subscriptions ss
      JOIN shops s ON s.shop_id = ss.shop_id
      LEFT JOIN stripe_customers sc ON sc.stripe_customer_id = ss.stripe_customer_id
    `;

    const params: any[] = [];
    if (status) {
      query += ' WHERE ss.status = $1';
      params.push(status);
    }

    query += ' ORDER BY ss.created_at DESC';
    query += ` LIMIT ${Number(limit)} OFFSET ${offset}`;

    const result = await db.query(query, params);
    
    // Transform the data to match frontend expectations
    const transformedRows = result.rows.map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      shopName: row.shop_name || 'Unknown Shop',
      email: row.shop_email || row.stripe_email || '',
      status: row.status || 'unknown',
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end || false,
      monthlyAmount: 500, // $500/month subscription
      totalPaid: row.total_paid || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripeCustomerId: row.stripe_customer_id,
      daysOverdue: row.status === 'past_due' ? 
        Math.floor((Date.now() - new Date(row.current_period_end).getTime()) / (1000 * 60 * 60 * 24)) : 0
    }));

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM stripe_subscriptions ss
    `;
    if (status) {
      countQuery += ' WHERE ss.status = $1';
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

// Get subscription statistics
router.get('/subscriptions/stats', async (req: Request, res: Response) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'canceled') as canceled_count,
        COUNT(*) FILTER (WHERE status = 'past_due') as past_due_count,
        COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid_count,
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 500 ELSE 0 END), 0) as monthly_revenue
      FROM stripe_subscriptions
    `;

    const result = await db.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        active: parseInt(stats.active_count),
        canceled: parseInt(stats.canceled_count),
        pastDue: parseInt(stats.past_due_count),
        unpaid: parseInt(stats.unpaid_count),
        total: parseInt(stats.total_count),
        monthlyRevenue: parseFloat(stats.monthly_revenue),
        yearlyRevenue: parseFloat(stats.monthly_revenue) * 12
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
    const { immediately = false } = req.body;

    await subscriptionService.cancelSubscription(subscriptionId, immediately);

    res.json({
      success: true,
      message: immediately ? 'Subscription canceled immediately' : 'Subscription will be canceled at end of billing period'
    });
  } catch (error) {
    logger.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

// Reactivate a canceled subscription
router.post('/subscriptions/:subscriptionId/reactivate', async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;

    // This would need implementation in SubscriptionService
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Subscription reactivation not yet implemented'
    });
  } catch (error) {
    logger.error('Error reactivating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate subscription'
    });
  }
});

export default router;