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

// Contract emergency controls
router.post('/contract/pause', 
  asyncHandler(adminController.pauseContract.bind(adminController))
);

router.post('/contract/unpause', 
  asyncHandler(adminController.unpauseContract.bind(adminController))
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
    
    console.log(`[PENDING_MINTS_DEBUG] Checking pending mints for shop: ${shopId}`);
    
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
        adminAddress: req.user?.address
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

// System maintenance
router.post('/maintenance/cleanup-webhooks', 
  asyncHandler(adminController.cleanupWebhooks.bind(adminController))
);

router.post('/maintenance/archive-transactions', 
  asyncHandler(adminController.archiveTransactions.bind(adminController))
);

// Manual redemption processing (temporary for testing)
// TODO: Implement processManualRedemption in AdminController
// router.post('/process-redemption',
//   validateRequired(['customerAddress', 'shopId', 'amount']),
//   validateEthereumAddress('customerAddress'),
//   validateNumeric('amount', 0.1, 1000),
//   asyncHandler(adminController.processManualRedemption.bind(adminController))
// );

// Treasury management routes
router.use('', treasuryRoutes);

// Analytics routes
router.use('/analytics', analyticsRoutes);

// Customer management routes
router.use('/customers', customerRoutes);

// Revenue distribution routes
router.use('/revenue', revenueRoutes);

// Subscription management routes
router.use('/subscription', subscriptionRoutes);

// Admin management routes (create, update, delete admins)
router.use('/admins', adminsRoutes);

// RCG management routes
import rcgManagementRoutes from '../../../routes/admin/rcg-management';
router.use('/rcg', rcgManagementRoutes);



// Shop management routes (includes manual RCG balance update)
import shopManagementRoutes from './shopManagement';
router.use('', shopManagementRoutes);


export default router;