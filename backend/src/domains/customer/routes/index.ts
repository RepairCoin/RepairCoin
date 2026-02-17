// backend/src/routes/customers.ts
import { Router } from 'express';
import { requireRole,authMiddleware } from '../../../middleware/auth';
import { validateCustomerRoleConflict } from '../../../middleware/roleConflictValidator';
import {
  validateRequired,
  validateEthereumAddress,
  validateEmail,
  validateNumeric,
  validateStringLength,
  validatePhoneNumber,
  asyncHandler
} from '../../../middleware/errorHandler';
import { validateCustomerUniqueness } from '../../../middleware/validation';
import { RateLimiter, createRateLimitMiddleware } from '../../../utils/rateLimiter';
import { verifyCaptchaRegister } from '../../../middleware/captcha';
import { CustomerController } from '../controllers/CustomerController';
import { CustomerService } from '../services/CustomerService';

// Import new route modules
import crossShopRoutes from './crossShop';
import exportDataRoutes from './exportData';
import balanceRoutes from './balance';
import notificationPreferencesRoutes from './notificationPreferences';

const router = Router();

// Rate limiter for unsuspension requests - limit to 3 requests per hour per address
const unsuspendRateLimiter = new RateLimiter({
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyGenerator: (address: string) => `unsuspend_${address.toLowerCase()}_${Math.floor(Date.now() / (60 * 60 * 1000))}`
});

const unsuspendRateLimit = createRateLimitMiddleware(
  unsuspendRateLimiter,
  (req) => req.params.address || req.ip
);

// Register sub-routes
router.use('/cross-shop', crossShopRoutes);
router.use('/balance', balanceRoutes);

// Register notification preferences routes (must be before /:address dynamic route)
router.use('/', notificationPreferencesRoutes);

// Public endpoint to get shops for customers (QR code generation)
router.get('/shops',
  asyncHandler(async (req, res) => {
    const { shopRepository } = require('../../../repositories');
    
    try {
      // Get active and verified shops only (public information)
      const result = await shopRepository.getShopsPaginated({
        page: 1,
        limit: 1000,
        active: true,
        verified: true
      });
      
      // Return only necessary public information
      const publicShops = result.items.map((shop: any) => ({
        shopId: shop.shopId,
        name: shop.name,
        verified: shop.verified,
        active: shop.active
      }));
      
      res.json({
        success: true,
        data: {
          shops: publicShops,
          count: publicShops.length
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch shops'
      });
    }
  })
);

// Initialize service and controller
const customerService = new CustomerService();
const customerController = new CustomerController(customerService);

// Register new customer (specific route first)
router.post('/register',
  verifyCaptchaRegister, // CAPTCHA verification
  validateRequired(['walletAddress']),
  validateEthereumAddress('walletAddress'),
  validateEmail('email'),
  validateStringLength('name', 255),
  validatePhoneNumber('phone'),
  validateCustomerUniqueness({ email: true, wallet: true }),
  validateCustomerRoleConflict,
  asyncHandler(customerController.registerCustomer.bind(customerController))
);

// List all customers (for shops to select from)
router.get('/',
  authMiddleware,
  requireRole(['admin', 'shop']),
  asyncHandler(customerController.listCustomers.bind(customerController))
);

// Get customer by wallet address (dynamic route last)
router.get('/:address', 
  validateEthereumAddress('address'),
  asyncHandler(customerController.getCustomer.bind(customerController))
);

// Update customer information
router.put('/:address',
  authMiddleware,
  requireRole(['admin', 'customer']),
  validateEthereumAddress('address'),
  validateEmail('email'),
  validateStringLength('name', 255),
  validatePhoneNumber('phone'),
  validateCustomerUniqueness({ email: true, wallet: false, excludeField: 'address' }),
  asyncHandler(customerController.updateCustomer.bind(customerController))
);

// Get customer transaction history
router.get('/:address/transactions',
  authMiddleware,
  validateEthereumAddress('address'),
  asyncHandler(customerController.getTransactionHistory.bind(customerController))
);

// Get customer analytics
router.get('/:address/analytics',
  authMiddleware,
  requireRole(['admin', 'customer', 'shop']),
  validateEthereumAddress('address'),
  asyncHandler(customerController.getCustomerAnalytics.bind(customerController))
);

// Manual token mint to customer (admin only)
router.post('/:address/mint',
  authMiddleware,
  requireRole(['admin']),
  validateEthereumAddress('address'),
  validateRequired(['amount', 'reason']),
  validateNumeric('amount', 0.1, 1000),
  asyncHandler(customerController.manualMint.bind(customerController))
);

// Check customer redemption eligibility
router.get('/:address/redemption-check',
  validateEthereumAddress('address'),
  validateRequired(['shopId', 'amount']),
  validateNumeric('amount', 0.1, 1000),
  asyncHandler(customerController.checkRedemptionEligibility.bind(customerController))
);

// Get customers by tier (admin only)
router.get('/tier/:tierLevel',
  authMiddleware,
  requireRole(['admin']),
  asyncHandler(customerController.getCustomersByTier.bind(customerController))
);

// Register export routes (must be before /:address route)
router.use('/', exportDataRoutes);

// Deactivate customer (admin only)
router.post('/:address/deactivate',
  authMiddleware,
  requireRole(['admin']),
  validateEthereumAddress('address'),
  asyncHandler(customerController.deactivateCustomer.bind(customerController))
);

// Request unsuspension
// Public endpoint (no auth required) with rate limiting to prevent abuse
router.post('/:address/request-unsuspend',
  unsuspendRateLimit,
  validateEthereumAddress('address'),
  validateRequired(['reason']),
  asyncHandler(customerController.requestUnsuspend.bind(customerController))
);

// Get customer's no-show status
router.get('/:address/no-show-status',
  authMiddleware,
  requireRole(['admin', 'customer', 'shop']),
  validateEthereumAddress('address'),
  asyncHandler(customerController.getNoShowStatus.bind(customerController))
);

// Get customer's no-show history
router.get('/:address/no-show-history',
  authMiddleware,
  requireRole(['admin', 'customer', 'shop']),
  validateEthereumAddress('address'),
  asyncHandler(customerController.getNoShowHistory.bind(customerController))
);

// Get customer's overall no-show status (shop-agnostic)
// This endpoint does not require a shopId and returns the customer's global tier
router.get('/:address/overall-no-show-status',
  authMiddleware,
  requireRole(['admin', 'customer', 'shop']),
  validateEthereumAddress('address'),
  asyncHandler(customerController.getOverallNoShowStatus.bind(customerController))
);

export default router;