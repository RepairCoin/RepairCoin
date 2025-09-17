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

// Mint shop's purchased RCN balance to blockchain
router.post('/shops/:shopId/mint-balance',
  asyncHandler(adminController.mintShopBalance.bind(adminController))
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

// RCG management routes
import rcgManagementRoutes from '../../../routes/admin/rcg-management';
router.use('/rcg', rcgManagementRoutes);



// Shop management routes (includes manual RCG balance update)
import shopManagementRoutes from './shopManagement';
router.use('', shopManagementRoutes);


export default router;