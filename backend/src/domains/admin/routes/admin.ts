// backend/src/routes/admin.ts
import { Router } from 'express';
import { authMiddleware, requireAdmin } from '../../../middleware/auth';
import { requirePermission, requireSuperAdmin } from '../../../middleware/permissions';
import { 
  validateRequired, 
  validateEthereumAddress, 
  validateNumeric,
  asyncHandler 
} from '../../../middleware/errorHandler';
import { AdminController } from '../controllers/AdminController';
import { AdminService } from '../services/AdminService';
import treasuryRoutes from './treasury';
import analyticsRoutes from './analytics';
import customerRoutes from './customers';
import revenueRoutes from '../../../routes/admin/revenue';
import subscriptionRoutes from './subscription';
import adminsRoutes from './admins';
import promoCodeRoutes from './promoCodes';
import sessionsRoutes from './sessions';
import adminTeamRoutes from './team';
import { logger } from '../../../utils/logger';

const router = Router();

// Initialize service and controller
const adminService = new AdminService();
const adminController = new AdminController(adminService);

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

// Platform statistics
router.get('/stats', 
  asyncHandler(adminController.getPlatformStats.bind(adminController))
);

// Customer management
router.get('/customers',
  requirePermission('manage_customers'),
  asyncHandler(adminController.getCustomers.bind(adminController))
);

// Get customer balance info
router.get('/customers/:address/balance',
  requirePermission('manage_customers'),
  validateEthereumAddress('address'),
  asyncHandler(adminController.getCustomerBalance.bind(adminController))
);

// Shop management
router.get('/shops', 
  requirePermission('manage_shops'),
  asyncHandler(adminController.getShops.bind(adminController))
);

// Manual token minting (emergency function)
router.post('/mint',
  validateRequired(['customerAddress', 'amount', 'reason']),
  validateEthereumAddress('customerAddress'),
  validateNumeric('amount', 0.1, 1000),
  asyncHandler(adminController.manualMint.bind(adminController))
);


// Shop creation (for admins)
router.post('/create-shop',
  requirePermission('manage_shops'),
  validateRequired(['shop_id', 'name', 'address', 'phone', 'email', 'wallet_address']),
  validateEthereumAddress('wallet_address'),
  asyncHandler(adminController.createShop.bind(adminController))
);

// Admin management (for super admins only)
router.post('/create-admin',
  requireSuperAdmin,
  validateRequired(['walletAddress', 'name', 'permissions']),
  validateEthereumAddress('walletAddress'),
  asyncHandler(adminController.createAdmin.bind(adminController))
);

// Get current admin profile
router.get('/me',
  asyncHandler(adminController.getAdminProfile.bind(adminController))
);

// Get all admins
router.get('/admins',
  requireSuperAdmin,
  asyncHandler(adminController.getAllAdmins.bind(adminController))
);

// Get specific admin
router.get('/admins/:adminId',
  asyncHandler(adminController.getAdmin.bind(adminController))
);

// Update admin (super admin only)
router.put('/admins/:adminId',
  requireSuperAdmin,
  asyncHandler(adminController.updateAdmin.bind(adminController))
);

// Delete admin (super admin only)
router.delete('/admins/:adminId',
  requireSuperAdmin,
  asyncHandler(adminController.deleteAdmin.bind(adminController))
);

// Update admin permissions (super admin only)
router.put('/admins/:adminId/permissions',
  requireSuperAdmin,
  validateRequired(['permissions']),
  asyncHandler(adminController.updateAdminPermissions.bind(adminController))
);

// Shop approval
router.post('/shops/:shopId/approve', 
  requirePermission('manage_shops'),
  asyncHandler(adminController.approveShop.bind(adminController))
);

// Customer suspension management
router.post('/customers/:address/suspend',
  requirePermission('manage_customers'),
  validateEthereumAddress('address'),
  asyncHandler(adminController.suspendCustomer.bind(adminController))
);

router.post('/customers/:address/unsuspend',
  requirePermission('manage_customers'),
  validateEthereumAddress('address'),
  asyncHandler(adminController.unsuspendCustomer.bind(adminController))
);

// Shop suspension management
router.post('/shops/:shopId/suspend',
  requirePermission('manage_shops'),
  asyncHandler(adminController.suspendShop.bind(adminController))
);

router.post('/shops/:shopId/unsuspend',
  requirePermission('manage_shops'),
  asyncHandler(adminController.unsuspendShop.bind(adminController))
);

// Shop editing
router.put('/shops/:shopId',
  requirePermission('manage_shops'),
  asyncHandler(adminController.updateShop.bind(adminController))
);

// Shop team & permissions management
router.use('/shops/:shopId/team',
  requirePermission('manage_shops'),
  adminTeamRoutes
);

// Shop verification
router.post('/shops/:shopId/verify',
  requirePermission('manage_shops'),
  asyncHandler(adminController.verifyShop.bind(adminController))
);

// Sell RCN to shops ($0.10 per token)
router.post('/shops/:shopId/sell-rcn',
  requirePermission('manage_shops'),
  validateRequired(['amount']),
  validateNumeric('amount', 100, 1000000),
  asyncHandler(adminController.sellRcnToShop.bind(adminController))
);

// Get shops with pending mints (database balance > blockchain balance)
router.get('/shops/pending-mints',
  asyncHandler(adminController.getPendingMints.bind(adminController))
);

// Debug route to check purchase statuses
router.get('/debug/purchase-status/:shopId',
  asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const db = require('../../../services/DatabaseService').DatabaseService.getInstance();
    
    const purchases = await db.query(`
      SELECT id, shop_id, amount, total_cost, status, payment_method, payment_reference, created_at, completed_at, minted_at
      FROM shop_rcn_purchases 
      WHERE shop_id = $1
      ORDER BY created_at DESC
    `, [shopId]);
    
    res.json({
      success: true,
      data: purchases.rows,
      summary: {
        total: purchases.rows.length,
        pending: purchases.rows.filter(p => p.status === 'pending').length,
        completed: purchases.rows.filter(p => p.status === 'completed').length,
        minted: purchases.rows.filter(p => p.minted_at).length
      }
    });
  })
);

// Debug route to check pending mints for a specific shop
router.get('/debug/pending-mints/:shopId',
  asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const db = require('../../../services/DatabaseService').DatabaseService.getInstance();
    const tokenService = require('../../../services/TokenService').TokenService;

    logger.debug('Checking pending mints for shop', { shopId });

    // Get shop details
    const shopQuery = await db.query('SELECT * FROM shops WHERE shop_id = $1', [shopId]);
    const shop = shopQuery.rows[0];
    
    if (!shop) {
      return res.json({ success: false, error: 'Shop not found' });
    }
    
    // Get completed purchases
    let completedPurchasesQuery;
    let usingMintedAt = false;
    try {
      completedPurchasesQuery = await db.query(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM shop_rcn_purchases 
        WHERE shop_id = $1 AND status = 'completed' AND minted_at IS NULL
      `, [shopId]);
      usingMintedAt = true;
    } catch (error) {
      // Fallback without minted_at
      completedPurchasesQuery = await db.query(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM shop_rcn_purchases 
        WHERE shop_id = $1 AND status = 'completed'
      `, [shopId]);
    }
    
    // Get all purchases by status
    const allPurchasesQuery = await db.query(`
      SELECT 
        status, 
        COUNT(*) as count, 
        COALESCE(SUM(amount), 0) as total_amount
      FROM shop_rcn_purchases 
      WHERE shop_id = $1
      GROUP BY status
    `, [shopId]);
    
    // Get blockchain balance
    const tokenServiceInstance = new tokenService();
    const blockchainBalance = await tokenServiceInstance.getBalance(shop.walletAddress);
    
    const totalCompleted = parseFloat(completedPurchasesQuery.rows[0]?.total_amount || '0');
    const pendingAmount = totalCompleted - blockchainBalance;
    
    res.json({
      success: true,
      data: {
        shop: {
          shopId: shop.shopId,
          name: shop.name,
          walletAddress: shop.walletAddress
        },
        purchases: {
          completed: completedPurchasesQuery.rows[0],
          byStatus: allPurchasesQuery.rows
        },
        balances: {
          totalCompletedPurchases: totalCompleted,
          blockchainBalance: blockchainBalance,
          pendingMintAmount: pendingAmount
        },
        shouldShowInPendingMints: pendingAmount > 0,
        debug: {
          usingMintedAtColumn: usingMintedAt
        }
      }
    });
  })
);

// Debug route to check all shops with purchases
router.get('/debug/all-shops-purchases',
  asyncHandler(async (req, res) => {
    const db = require('../../../services/DatabaseService').DatabaseService.getInstance();
    
    // Get all shops with any purchases
    const shopsQuery = await db.query(`
      SELECT 
        s.shop_id,
        s.name,
        s.wallet_address,
        s.active,
        s.verified,
        COUNT(DISTINCT p.id) as total_purchases,
        COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) as completed_purchases,
        COUNT(DISTINCT CASE WHEN p.status = 'pending' THEN p.id END) as pending_purchases,
        COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_completed_amount,
        COALESCE(SUM(p.amount), 0) as total_all_amount
      FROM shops s
      LEFT JOIN shop_rcn_purchases p ON s.shop_id = p.shop_id
      GROUP BY s.shop_id, s.name, s.wallet_address, s.active, s.verified
      HAVING COUNT(p.id) > 0
      ORDER BY total_completed_amount DESC
    `);
    
    res.json({
      success: true,
      data: {
        totalShopsWithPurchases: shopsQuery.rows.length,
        shops: shopsQuery.rows
      }
    });
  })
);

// Get shop's pending mint amount (unminted completed purchases)
router.get('/shops/:shopId/pending-mint-amount',
  asyncHandler(adminController.getShopPendingMintAmount.bind(adminController))
);

// Mint shop's purchased RCN balance to blockchain
router.post('/shops/:shopId/mint-balance',
  asyncHandler(adminController.mintShopBalance.bind(adminController))
);

// Manually complete a pending purchase (admin override)
router.post('/shops/:shopId/complete-purchase/:purchaseId',
  asyncHandler(async (req, res) => {
    try {
      const { shopId, purchaseId } = req.params;
      const { paymentReference } = req.body;
      
      const db = require('../../../services/DatabaseService').DatabaseService.getInstance();
      
      // Verify the purchase exists and belongs to this shop
      const purchaseQuery = await db.query(
        'SELECT * FROM shop_rcn_purchases WHERE id = $1 AND shop_id = $2 AND status = $3',
        [purchaseId, shopId, 'pending']
      );
      
      if (purchaseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Pending purchase not found for this shop'
        });
      }
      
      const purchase = purchaseQuery.rows[0];
      
      // Complete the purchase
      await db.query(`
        UPDATE shop_rcn_purchases 
        SET status = 'completed', 
            completed_at = NOW(), 
            payment_reference = COALESCE($2, payment_reference)
        WHERE id = $1
      `, [purchaseId, paymentReference || `ADMIN_MANUAL_${Date.now()}`]);
      
      logger.info('Admin manually completed purchase', {
        purchaseId,
        shopId,
        amount: purchase.amount,
        adminAddress: req.user?.address,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Purchase completed successfully',
        data: {
          purchaseId,
          shopId,
          amount: purchase.amount,
          totalCost: purchase.total_cost,
          status: 'completed'
        }
      });
    } catch (error: any) {
      logger.error('Error completing purchase:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to complete purchase'
      });
    }
  })
);

// Unsuspend requests management
router.get('/unsuspend-requests',
  asyncHandler(adminController.getUnsuspendRequests.bind(adminController))
);

router.post('/unsuspend-requests/:requestId/approve',
  asyncHandler(adminController.approveUnsuspendRequest.bind(adminController))
);

router.post('/unsuspend-requests/:requestId/reject',
  asyncHandler(adminController.rejectUnsuspendRequest.bind(adminController))
);

// Webhook management
router.get('/webhooks/failed',
  asyncHandler(adminController.getFailedWebhooks.bind(adminController))
);

// Webhook monitoring console (admin-authed; reuses the real logging service)
router.get('/webhooks/logs', asyncHandler(async (req, res) => {
  const { webhookLoggingService } = await import('../../../services/WebhookLoggingService');
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25', 10)));
  const result = await webhookLoggingService.getWebhookLogs({
    page,
    limit,
    status: req.query.status as string,
    source: req.query.source as string,
    eventType: req.query.eventType as string,
  });
  res.json({ success: true, data: result });
}));

router.get('/webhooks/health', asyncHandler(async (req, res) => {
  // Compute health directly from webhook_logs so it doesn't depend on the
  // get_webhook_health() DB function (not present in every environment).
  const { getSharedPool } = await import('../../../utils/database-pool');
  const pool = getSharedPool();
  const r = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours')::int AS failed_24h,
      COUNT(*) FILTER (WHERE status IN ('pending','processing','retry'))::int AS pending,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS total_24h,
      COUNT(*) FILTER (WHERE status = 'success' AND created_at >= NOW() - INTERVAL '24 hours')::int AS success_24h
    FROM webhook_logs
  `);
  const s = r.rows[0];
  const successRate24h = s.total_24h > 0 ? (s.success_24h / s.total_24h) * 100 : 100;
  // Healthy when there are no recent failures, or the success rate holds up with volume.
  const healthy = s.failed_24h === 0 ? true : (s.total_24h >= 10 && successRate24h >= 90);
  res.json({
    success: true,
    data: {
      healthy,
      failedLast24h: s.failed_24h,
      pendingCount: s.pending,
      total: s.total,
      successRate24h: Math.round(successRate24h),
    },
  });
}));

router.post('/webhooks/retry/:webhookId', asyncHandler(async (req, res) => {
  const { webhookService } = await import('../../webhook/services/WebhookService');
  const result = await webhookService.retryFailedWebhook(req.params.webhookId);
  res.json({ success: result?.success !== false, data: result });
}));

// Announcement broadcast — recipient counts for the composer
router.get('/notifications/audience-counts', asyncHandler(async (req, res) => {
  const { getSharedPool } = await import('../../../utils/database-pool');
  const pool = getSharedPool();
  const shopRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM shops WHERE COALESCE(wallet_address, address) IS NOT NULL`
  );
  const custRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM customers WHERE COALESCE(address, wallet_address) IS NOT NULL`
  );
  const shops = shopRes.rows[0].c;
  const customers = custRes.rows[0].c;
  res.json({ success: true, data: { shops, customers, all: shops + customers } });
}));

// Announcement broadcast — fan out a platform announcement via the notification gateway
router.post('/notifications/broadcast', asyncHandler(async (req, res) => {
  const { audience, title, message } = req.body || {};
  if (!['shops', 'customers', 'all'].includes(audience)) {
    return res.status(400).json({ success: false, error: 'audience must be shops, customers, or all' });
  }
  if (!message || !String(message).trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  const { getSharedPool } = await import('../../../utils/database-pool');
  const { getNotificationGateway } = await import('../../notification/services/NotificationGateway');
  const pool = getSharedPool();

  const addresses: string[] = [];
  if (audience === 'shops' || audience === 'all') {
    const r = await pool.query(
      `SELECT DISTINCT COALESCE(wallet_address, address) AS addr FROM shops WHERE COALESCE(wallet_address, address) IS NOT NULL`
    );
    addresses.push(...r.rows.map((x: { addr: string }) => x.addr));
  }
  if (audience === 'customers' || audience === 'all') {
    const r = await pool.query(
      `SELECT DISTINCT COALESCE(address, wallet_address) AS addr FROM customers WHERE COALESCE(address, wallet_address) IS NOT NULL`
    );
    addresses.push(...r.rows.map((x: { addr: string }) => x.addr));
  }
  const unique = Array.from(new Set(addresses.map((a) => a.toLowerCase())));

  const gateway = getNotificationGateway();
  const sender = req.user?.address || 'ADMIN';
  const meta = { title: title ? String(title).trim() : undefined, message: String(message).trim() };

  // Fan out in batches so a large recipient list doesn't overwhelm the pool.
  let delivered = 0;
  const BATCH = 25;
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      chunk.map((addr) =>
        gateway.dispatch('admin_announcement', addr, {
          message: meta.message,
          metadata: meta,
          senderAddress: sender,
        })
      )
    );
    // Non-null result = delivered (null = muted by preference or suppressed).
    delivered += results.filter((r) => r.status === 'fulfilled' && r.value).length;
  }

  logger.info('Admin announcement broadcast', {
    audience,
    recipients: unique.length,
    delivered,
    by: sender,
  });
  res.json({ success: true, data: { recipients: unique.length, delivered } });
}));

// Affiliate shop groups — platform oversight (coalitions + custom-token liability)
router.get('/affiliate-groups', asyncHandler(async (req, res) => {
  const { getSharedPool } = await import('../../../utils/database-pool');
  const pool = getSharedPool();

  const groupsRes = await pool.query(`
    SELECT
      g.group_id,
      g.group_name,
      g.group_type,
      g.active,
      g.custom_token_name,
      g.custom_token_symbol,
      COALESCE(g.token_value_usd, 0)::float AS token_value_usd,
      g.created_by_shop_id,
      g.created_at,
      (SELECT COUNT(*) FROM affiliate_shop_group_members m WHERE m.group_id = g.group_id AND m.status = 'active')::int AS member_count,
      (SELECT COUNT(*) FROM affiliate_shop_group_members m WHERE m.group_id = g.group_id AND m.status = 'pending')::int AS pending_members,
      COALESCE((SELECT SUM(balance) FROM customer_affiliate_group_balances b WHERE b.group_id = g.group_id), 0)::float AS outstanding_balance,
      COALESCE((SELECT SUM(lifetime_earned) FROM customer_affiliate_group_balances b WHERE b.group_id = g.group_id), 0)::float AS lifetime_earned,
      COALESCE((SELECT SUM(lifetime_redeemed) FROM customer_affiliate_group_balances b WHERE b.group_id = g.group_id), 0)::float AS lifetime_redeemed,
      (SELECT COUNT(DISTINCT customer_address) FROM customer_affiliate_group_balances b WHERE b.group_id = g.group_id)::int AS holder_count,
      COALESCE((SELECT SUM(allocated_rcn) FROM shop_group_rcn_allocations a WHERE a.group_id = g.group_id), 0)::float AS rcn_allocated,
      COALESCE((SELECT SUM(available_rcn) FROM shop_group_rcn_allocations a WHERE a.group_id = g.group_id), 0)::float AS rcn_available
    FROM affiliate_shop_groups g
    ORDER BY g.created_at DESC
  `);

  const groups = groupsRes.rows.map((g: Record<string, unknown>) => {
    const outstanding = Number(g.outstanding_balance) || 0;
    const tokenValue = Number(g.token_value_usd) || 0;
    return {
      groupId: g.group_id as string,
      groupName: g.group_name as string,
      groupType: g.group_type as string,
      active: Boolean(g.active),
      customTokenName: g.custom_token_name as string | null,
      customTokenSymbol: g.custom_token_symbol as string | null,
      tokenValueUsd: tokenValue,
      createdByShopId: g.created_by_shop_id as string | null,
      createdAt: g.created_at as string,
      memberCount: Number(g.member_count) || 0,
      pendingMembers: Number(g.pending_members) || 0,
      outstandingBalance: outstanding,
      lifetimeEarned: Number(g.lifetime_earned) || 0,
      lifetimeRedeemed: Number(g.lifetime_redeemed) || 0,
      holderCount: Number(g.holder_count) || 0,
      rcnAllocated: Number(g.rcn_allocated) || 0,
      rcnAvailable: Number(g.rcn_available) || 0,
      liabilityUsd: outstanding * tokenValue,
    };
  });

  const summary = {
    totalGroups: groups.length,
    activeGroups: groups.filter((g) => g.active).length,
    totalMembers: groups.reduce((s, g) => s + (g.memberCount || 0), 0),
    totalOutstandingTokens: groups.reduce((s, g) => s + (g.outstandingBalance || 0), 0),
    totalLiabilityUsd: groups.reduce((s, g) => s + (g.liabilityUsd || 0), 0),
    totalRcnAllocated: groups.reduce((s, g) => s + (g.rcnAllocated || 0), 0),
  };

  res.json({ success: true, data: { summary, groups } });
}));

// Referral program analytics (platform-wide)
router.get('/referrals/analytics', asyncHandler(async (req, res) => {
  const { getSharedPool } = await import('../../../utils/database-pool');
  const pool = getSharedPool();

  const summaryRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed,
      COUNT(*) FILTER (WHERE completed_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()))::int AS pending,
      COUNT(*) FILTER (WHERE completed_at IS NULL AND expires_at IS NOT NULL AND expires_at <= NOW())::int AS expired,
      COALESCE(SUM(CASE WHEN completed_at IS NOT NULL THEN COALESCE(reward_amount,0) + COALESCE(referee_bonus,0) ELSE 0 END), 0)::float AS rcn_paid,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last7,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last30
    FROM referrals
  `);
  const s = summaryRes.rows[0];
  const conversionRate = s.total > 0 ? (s.completed / s.total) * 100 : 0;

  // Leaderboard computed directly from referrals (there is no referral_stats view here).
  const lbRes = await pool.query(`
    SELECT
      r.referrer_address,
      c.name AS referrer_name,
      COUNT(*)::int AS total_referrals,
      COUNT(*) FILTER (WHERE r.completed_at IS NOT NULL)::int AS successful_referrals,
      COALESCE(SUM(CASE WHEN r.completed_at IS NOT NULL THEN COALESCE(r.reward_amount,0) ELSE 0 END), 0)::float AS total_earned_rcn,
      MAX(r.created_at) AS last_referral_date
    FROM referrals r
    LEFT JOIN customers c ON LOWER(c.address) = LOWER(r.referrer_address)
    GROUP BY r.referrer_address, c.name
    ORDER BY successful_referrals DESC, total_earned_rcn DESC
    LIMIT 20
  `);
  const leaderboard = lbRes.rows.map((row: Record<string, unknown>) => ({
    referrerAddress: row.referrer_address as string,
    referrerName: (row.referrer_name as string) || undefined,
    totalReferrals: Number(row.total_referrals) || 0,
    successfulReferrals: Number(row.successful_referrals) || 0,
    totalEarnedRcn: Number(row.total_earned_rcn) || 0,
    lastReferralDate: row.last_referral_date as string | undefined,
  }));

  res.json({
    success: true,
    data: {
      summary: {
        total: s.total,
        completed: s.completed,
        pending: s.pending,
        expired: s.expired,
        rcnPaid: s.rcn_paid,
        conversionRate,
        last7Days: s.last7,
        last30Days: s.last30,
      },
      leaderboard,
    },
  });
}));

// System maintenance
router.post('/maintenance/cleanup-webhooks', 
  asyncHandler(adminController.cleanupWebhooks.bind(adminController))
);

router.post('/maintenance/archive-transactions', 
  asyncHandler(adminController.archiveTransactions.bind(adminController))
);

// Contract monitoring
router.get('/monitoring/status', 
  asyncHandler(async (req, res) => {
    const { contractMonitoringService } = await import('../../../services/ContractMonitoringService');
    const status = contractMonitoringService.getStatus();
    res.json({ success: true, data: status });
  })
);

router.post('/monitoring/test-alert',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { contractMonitoringService } = await import('../../../services/ContractMonitoringService');
    await contractMonitoringService.sendTestAlert();
    res.json({ success: true, message: 'Test alert sent' });
  })
);

// Test subscription reminder - triggers reminder check immediately
router.post('/test/subscription-reminders',
  asyncHandler(async (req, res) => {
    const { subscriptionReminderService } = await import('../../../services/SubscriptionReminderService');

    logger.info('Admin triggered subscription reminder test', { adminAddress: req.user?.address });

    const report = await subscriptionReminderService.processAllReminders();

    res.json({
      success: true,
      message: 'Subscription reminder check completed',
      data: report
    });
  })
);

// Set subscription to expire soon for testing reminders
router.post('/test/subscription-reminders/setup/:shopId',
  asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const { daysUntilExpiry = 1 } = req.body;

    const db = require('../../../services/DatabaseService').DatabaseService.getInstance();

    // Update subscription to expire in specified days
    const result = await db.query(`
      UPDATE stripe_subscriptions
      SET current_period_end = NOW() + INTERVAL '${daysUntilExpiry} days',
          reminder_7d_sent = false,
          reminder_3d_sent = false,
          reminder_1d_sent = false,
          updated_at = NOW()
      WHERE shop_id = $1
      RETURNING shop_id, current_period_end, status
    `, [shopId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found for this shop'
      });
    }

    logger.info('Admin set up subscription reminder test', {
      shopId,
      daysUntilExpiry,
      newExpirationDate: result.rows[0].current_period_end,
      adminAddress: req.user?.address
    });

    res.json({
      success: true,
      message: `Subscription set to expire in ${daysUntilExpiry} day(s)`,
      data: {
        shopId,
        newExpirationDate: result.rows[0].current_period_end,
        status: result.rows[0].status,
        remindersFlagsReset: true
      }
    });
  })
);


// Treasury management routes
router.use('', treasuryRoutes);

// Fraud & Abuse Detection — Trust & Safety review queue (Admin AI #1)
import fraudRoutes from './fraud';
router.use('', fraudRoutes);

// Platform Health Copilot — "ask the platform" admin assistant (Admin AI #2)
import { makePlatformCopilotController } from '../../AIAgentDomain/controllers/PlatformCopilotController';
const platformCopilot = makePlatformCopilotController();
router.post('/ai/platform-copilot', (req, res) => { void platformCopilot.ask(req, res); });

// Smart Command Bar (⌘K) brain — routes a query to navigation or a data answer.
import { makeCommandBarController } from '../../AIAgentDomain/controllers/CommandBarController';
const commandBar = makeCommandBarController();
router.post('/ai/command', (req, res) => { void commandBar.run(req, res); });

// AI Content Moderation (Admin AI #5) — flag inappropriate listings/reviews.
import { scanContent, deactivateService, removeReview } from '../../AIAgentDomain/services/contentModeration';
router.get('/content-moderation/scan', async (req, res) => {
  try {
    const force = req.query.refresh === 'true';
    const result = await scanContent(force);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Content moderation scan failed:', error);
    res.status(500).json({ success: false, error: 'Content scan failed' });
  }
});
router.post('/content-moderation/service/:serviceId/deactivate', async (req, res) => {
  try {
    const ok = await deactivateService(req.params.serviceId);
    if (!ok) return res.status(404).json({ success: false, error: 'Service not found' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to deactivate service:', error);
    res.status(500).json({ success: false, error: 'Failed to deactivate service' });
  }
});
router.post('/content-moderation/review/:reviewId/remove', async (req, res) => {
  try {
    const ok = await removeReview(req.params.reviewId);
    if (!ok) return res.status(404).json({ success: false, error: 'Review not found' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove review:', error);
    res.status(500).json({ success: false, error: 'Failed to remove review' });
  }
});

// Support Ticket Triage (Admin AI #4) — suggest category/priority/summary/reply.
import { getSupportTriage } from '../../AIAgentDomain/services/supportTriage';
router.get('/support/tickets/:ticketId/ai-triage', async (req, res) => {
  try {
    const force = req.query.refresh === 'true';
    const triage = await getSupportTriage(req.params.ticketId, force);
    if (!triage) return res.status(404).json({ success: false, error: 'Ticket not found' });
    res.json({ success: true, data: triage });
  } catch (error) {
    logger.error('Error generating support triage:', error);
    res.status(500).json({ success: false, error: 'Failed to triage ticket' });
  }
});

// Shop Approval Assistant (Admin AI #3) — AI screening for a pending shop.
import { getShopScreening } from '../../AIAgentDomain/services/shopScreening';
router.get('/shops/:shopId/ai-screening', async (req, res) => {
  try {
    const force = req.query.refresh === 'true';
    const screening = await getShopScreening(req.params.shopId, force);
    if (!screening) return res.status(404).json({ success: false, error: 'Shop not found' });
    res.json({ success: true, data: screening });
  } catch (error) {
    logger.error('Error generating shop screening:', error);
    res.status(500).json({ success: false, error: 'Failed to screen shop' });
  }
});

// Daily Executive Briefing (Platform Copilot Phase 3) — cached once/day.
import { getExecutiveBriefing } from '../../AIAgentDomain/services/platform/executiveBriefing';
router.get('/ai/briefing', async (req, res) => {
  try {
    const force = req.query.refresh === 'true';
    const briefing = await getExecutiveBriefing(force);
    res.json({ success: true, data: briefing });
  } catch (error) {
    logger.error('Error generating executive briefing:', error);
    res.status(500).json({ success: false, error: 'Failed to generate briefing' });
  }
});

// Analytics routes
router.use('/analytics', analyticsRoutes);

// Promo code management routes (admin endpoints from shop promo codes)
router.use('', promoCodeRoutes);

// Customer management routes
router.use('/customers', customerRoutes);

// Revenue distribution routes
router.use('/revenue', revenueRoutes);

// Subscription management routes
router.use('/subscription', subscriptionRoutes);

// Admin management routes (create, update, delete admins)
router.use('/admins', adminsRoutes);

// Session management routes
router.use('/sessions', sessionsRoutes);

// RCG management routes
import rcgManagementRoutes from '../../../routes/admin/rcg-management';
router.use('/rcg', rcgManagementRoutes);



// Shop management routes (includes manual RCG balance update)
import shopManagementRoutes from './shopManagement';
router.use('', shopManagementRoutes);

// Bug report management routes
import bugReportAdminRoutes from './bugReports';
router.use('/bug-reports', bugReportAdminRoutes);

// Moderation: shop issue reports + flagged reviews
import moderationAdminRoutes from './moderation';
router.use('/moderation', moderationAdminRoutes);

// System settings routes
import settingsRoutes from './settings';
router.use('/settings', settingsRoutes);

// Contract management routes
import contractRoutes from './contract';
router.use('/contract', contractRoutes);

// Purchase auto-complete routes
import purchaseAutoCompleteRoutes from '../../shop/routes/purchase-auto-complete';
router.use('/purchases', purchaseAutoCompleteRoutes);

export default router;