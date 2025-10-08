// backend/src/domains/admin/routes/contract.ts
import { Router } from 'express';
import { authMiddleware, requireAdmin } from '../../../middleware/auth';
import { requireSuperAdmin, requirePermission } from '../../../middleware/permissions';
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

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

// Contract status check (available to all admins)
router.get('/status',
  asyncHandler(adminController.getContractStatus.bind(adminController))
);

// Contract pause/unpause (super admin only)
router.post('/pause', 
  requireSuperAdmin,
  asyncHandler(adminController.pauseContract.bind(adminController))
);

router.post('/unpause', 
  requireSuperAdmin,
  asyncHandler(adminController.unpauseContract.bind(adminController))
);

// Emergency stop mechanism (super admin only)
router.post('/emergency-stop',
  requireSuperAdmin,
  asyncHandler(adminController.emergencyStop.bind(adminController))
);

// Manual redemption processing (admins with customer management permission)
router.post('/manual-redemption',
  requirePermission('manage_customers'),
  validateRequired(['customerAddress', 'shopId', 'amount', 'reason']),
  validateEthereumAddress('customerAddress'),
  validateNumeric('amount', 0.1, 10000),
  asyncHandler(adminController.processManualRedemption.bind(adminController))
);

export default router;