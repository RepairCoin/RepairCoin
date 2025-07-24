// backend/src/routes/admin.ts
import { Router } from 'express';
import { authMiddleware, requireAdmin } from '../../../middleware/auth';
import { 
  validateRequired, 
  validateEthereumAddress, 
  validateNumeric,
  asyncHandler 
} from '../../../middleware/errorHandler';
import { AdminController } from '../controllers/AdminController';
import { AdminService } from '../services/AdminService';

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
  asyncHandler(adminController.getCustomers.bind(adminController))
);

// Shop management
router.get('/shops', 
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
  validateRequired(['shop_id', 'name', 'address', 'phone', 'email', 'wallet_address']),
  validateEthereumAddress('wallet_address'),
  asyncHandler(adminController.createShop.bind(adminController))
);

// Admin creation (for super admins)
router.post('/create-admin',
  validateRequired(['walletAddress', 'permissions']),
  validateEthereumAddress('walletAddress'),
  asyncHandler(adminController.createAdmin.bind(adminController))
);

// Shop approval
router.post('/shops/:shopId/approve', 
  asyncHandler(adminController.approveShop.bind(adminController))
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

export default router;