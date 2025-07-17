// backend/src/routes/customers.ts
import { Router } from 'express';
import { requireRole,authMiddleware } from '../../../middleware/auth';
import { 
  validateRequired, 
  validateEthereumAddress, 
  validateEmail, 
  validateNumeric,
  asyncHandler 
} from '../../../middleware/errorHandler';
import { CustomerController } from '../controllers/CustomerController';
import { CustomerService } from '../services/CustomerService';

const router = Router();

// Initialize service and controller
const customerService = new CustomerService();
const customerController = new CustomerController(customerService);

// Get customer by wallet address
router.get('/:address', 
  validateEthereumAddress('address'),
  asyncHandler(customerController.getCustomer.bind(customerController))
);

// Register new customer
router.post('/register',
  validateRequired(['walletAddress']),
  validateEthereumAddress('walletAddress'),
  validateEmail('email'),
  asyncHandler(customerController.registerCustomer.bind(customerController))
);

// Update customer information
router.put('/:address',
  authMiddleware,
  requireRole(['admin', 'customer']),
  validateEthereumAddress('address'),
  validateEmail('email'),
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
  requireRole(['admin', 'customer']),
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

// Deactivate customer (admin only)
router.post('/:address/deactivate',
  authMiddleware,
  requireRole(['admin']),
  validateEthereumAddress('address'),
  asyncHandler(customerController.deactivateCustomer.bind(customerController))
);

export default router;