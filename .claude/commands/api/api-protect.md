# Add Authentication & Authorization to API Endpoint (RepairCoin)

Add RepairCoin's JWT-based authentication and role-based authorization to secure an existing API endpoint.

## Target API Route

$ARGUMENTS

---

## RepairCoin Security Architecture

RepairCoin uses:
1. **JWT Authentication** - Token-based auth with wallet addresses
2. **Role-Based Access Control** - admin, shop, customer roles
3. **Validation Middleware** - Input sanitization and type checking
4. **Rate Limiting** - Prevent abuse with configurable limits
5. **Event Logging** - Security event tracking

---

## Step 1: Add Authentication Middleware

### Basic Authentication (JWT Required)

```typescript
import { authMiddleware } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/errorHandler';

// Before (unprotected)
router.get('/endpoint',
  asyncHandler(controller.method.bind(controller))
);

// After (JWT authentication required)
router.get('/endpoint',
  authMiddleware,  // ← Validates JWT token
  asyncHandler(controller.method.bind(controller))
);
```

**What `authMiddleware` does:**
- Validates `Authorization: Bearer <token>` header
- Verifies JWT signature with `JWT_SECRET`
- Checks token expiration
- Attaches `req.user` with { address, role, shopId? }
- Returns 401 if token is missing/invalid

---

## Step 2: Add Role-Based Authorization

### Single Role

```typescript
import { authMiddleware, requireRole } from '../../../middleware/auth';

// Admin only
router.post('/admin/action',
  authMiddleware,
  requireRole(['admin']),  // ← Only admins can access
  asyncHandler(controller.method.bind(controller))
);
```

### Multiple Roles

```typescript
// Admin or Shop
router.post('/reward',
  authMiddleware,
  requireRole(['admin', 'shop']),  // ← Either role works
  asyncHandler(controller.method.bind(controller))
);

// Admin or Customer (for personal data)
router.get('/:address/profile',
  authMiddleware,
  requireRole(['admin', 'customer']),
  asyncHandler(controller.method.bind(controller))
);
```

### Available Roles

- `admin` - Platform administrators (from `ADMIN_ADDRESSES`)
- `shop` - Registered shops with active subscriptions
- `customer` - Registered customers with wallets

---

## Step 3: Add Input Validation

### Validation Middleware

```typescript
import {
  validateRequired,
  validateEthereumAddress,
  validateEmail,
  validateNumeric,
  asyncHandler
} from '../../../middleware/errorHandler';

router.post('/create',
  authMiddleware,
  requireRole(['admin']),

  // Validation middleware
  validateRequired(['walletAddress', 'amount']),
  validateEthereumAddress('walletAddress'),
  validateNumeric('amount', 0.1, 1000),  // min: 0.1, max: 1000

  asyncHandler(controller.method.bind(controller))
);
```

### Available Validators

```typescript
validateRequired(['field1', 'field2'])      // Required fields
validateEthereumAddress('walletAddress')    // Valid Ethereum address
validateEmail('email')                      // Valid email format
validateNumeric('amount', min, max)         // Numeric range validation
```

---

## Step 4: Add Authorization Logic in Service

Controllers handle routing, but authorization business logic belongs in **services**:

```typescript
// backend/src/domains/{domain}/services/{Feature}Service.ts

export class FeatureService {
  async updateResource(input: UpdateInput): Promise<unknown> {
    // Check ownership (customers can only modify their own data)
    if (input.userRole === 'customer' && input.userAddress !== input.targetAddress) {
      throw new Error('Can only update your own data');
    }

    // Check permissions (only shops/admins can mint)
    if (input.action === 'mint' && !['admin', 'shop'].includes(input.userRole || '')) {
      throw new Error('Insufficient permissions to mint tokens');
    }

    // Shops can only modify their own resources
    if (input.userRole === 'shop' && input.shopId !== input.targetShopId) {
      throw new Error('Can only modify your own shop resources');
    }

    // Proceed with operation
    const result = await this.repository.update(input);
    return result;
  }
}
```

---

## Step 5: Add Rate Limiting

### Custom Rate Limiter

```typescript
import { RateLimiter, createRateLimitMiddleware } from '../../../utils/rateLimiter';

// Create rate limiter (3 requests per hour per address)
const unsuspendRateLimiter = new RateLimiter({
  maxRequests: 3,
  windowMs: 60 * 60 * 1000,  // 1 hour
  keyGenerator: (address: string) => `unsuspend_${address.toLowerCase()}`
});

const unsuspendRateLimit = createRateLimitMiddleware(
  unsuspendRateLimiter,
  (req) => req.params.address || req.ip
);

// Apply to route
router.post('/:address/request-unsuspend',
  unsuspendRateLimit,  // ← Rate limiting middleware
  validateEthereumAddress('address'),
  asyncHandler(controller.method.bind(controller))
);
```

### Rate Limit Configuration

```typescript
new RateLimiter({
  maxRequests: number,      // Max requests in window
  windowMs: number,         // Time window in milliseconds
  keyGenerator: (key) => string  // Generate unique key per user/IP
});
```

---

## Step 6: Role Conflict Prevention

Prevent users from having multiple roles (admin + customer, shop + customer):

```typescript
import { validateCustomerRoleConflict } from '../../../middleware/roleConflictValidator';

router.post('/register',
  validateRequired(['walletAddress']),
  validateEthereumAddress('walletAddress'),
  validateCustomerRoleConflict,  // ← Prevents role conflicts
  asyncHandler(controller.registerCustomer.bind(controller))
);
```

**What it does:**
- Checks if wallet address is already registered as admin or shop
- Returns 409 Conflict if role conflict exists
- Logs security warnings

---

## Step 7: Security Logging

RepairCoin automatically logs security events via `logger.security()`:

```typescript
import { logger } from '../../../utils/logger';

// In middleware/services
logger.security('Failed authentication attempt', {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  path: req.path
});

logger.security('Authorization failure', {
  requiredRole: 'admin',
  userRole: req.user?.role,
  resource: req.path
});

logger.security('Suspicious activity detected', {
  address: req.user?.address,
  action: 'multiple_failed_attempts'
});
```

---

## Common Protection Patterns

### Pattern 1: Public Endpoint (No Auth)

```typescript
// QR code generation, shop listings
router.get('/public/shops',
  asyncHandler(controller.getShops.bind(controller))
);
```

### Pattern 2: Authenticated Only

```typescript
// Any logged-in user
router.get('/profile',
  authMiddleware,
  asyncHandler(controller.getProfile.bind(controller))
);
```

### Pattern 3: Role-Based

```typescript
// Admin only
router.delete('/users/:id',
  authMiddleware,
  requireRole(['admin']),
  asyncHandler(controller.deleteUser.bind(controller))
);
```

### Pattern 4: Owner or Admin

```typescript
// Customer can access own data, admin can access any
router.get('/:address/transactions',
  authMiddleware,
  requireRole(['admin', 'customer']),
  // Check ownership in service layer
  asyncHandler(controller.getTransactions.bind(controller))
);
```

### Pattern 5: Public with Rate Limiting

```typescript
// Webhook endpoints, public APIs
router.post('/webhooks/fixflow',
  webhookRateLimit,
  validateRequired(['payload']),
  asyncHandler(controller.processWebhook.bind(controller))
);
```

---

## Error Responses

RepairCoin uses `ResponseHelper` for consistent error responses:

```typescript
import { ResponseHelper } from '../../../utils/responseHelper';

// 401 Unauthorized (missing/invalid token)
ResponseHelper.unauthorized(res, 'Authentication required');

// 403 Forbidden (insufficient permissions)
ResponseHelper.forbidden(res, 'Insufficient permissions');

// 409 Conflict (role conflict)
ResponseHelper.conflict(res, 'Wallet already registered as shop');

// 429 Too Many Requests (rate limit exceeded)
ResponseHelper.error(res, 'Rate limit exceeded', 429);
```

---

## Complete Example: Secure Endpoint

```typescript
import { Router } from 'express';
import { authMiddleware, requireRole } from '../../../middleware/auth';
import {
  validateRequired,
  validateEthereumAddress,
  validateNumeric,
  asyncHandler
} from '../../../middleware/errorHandler';
import { RateLimiter, createRateLimitMiddleware } from '../../../utils/rateLimiter';
import { RewardController } from '../controllers/RewardController';
import { RewardService } from '../services/RewardService';

const router = Router();

// Rate limiter: 100 requests per hour
const rewardRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (shopId: string) => `reward_${shopId}`
});

const rewardRateLimit = createRateLimitMiddleware(
  rewardRateLimiter,
  (req) => req.user?.shopId || req.ip
);

const rewardService = new RewardService();
const rewardController = new RewardController(rewardService);

/**
 * @swagger
 * /api/shops/rewards:
 *   post:
 *     summary: Issue reward to customer
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerAddress
 *               - amount
 *             properties:
 *               customerAddress:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Reward issued successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/rewards',
  authMiddleware,                           // 1. JWT authentication
  requireRole(['admin', 'shop']),           // 2. Role authorization
  rewardRateLimit,                          // 3. Rate limiting
  validateRequired(['customerAddress', 'amount']),  // 4. Required fields
  validateEthereumAddress('customerAddress'),       // 5. Address validation
  validateNumeric('amount', 0.1, 1000),             // 6. Numeric validation
  asyncHandler(rewardController.issueReward.bind(rewardController))  // 7. Handler
);

export default router;
```

---

## Security Checklist

- [ ] Added `authMiddleware` for JWT validation
- [ ] Added `requireRole` for authorization
- [ ] Added input validation middleware
- [ ] Implemented ownership checks in service
- [ ] Added rate limiting if needed
- [ ] Prevented role conflicts
- [ ] Used `ResponseHelper` for errors
- [ ] Added security logging
- [ ] Tested with valid/invalid tokens
- [ ] Tested with different roles
- [ ] Verified error messages don't leak sensitive info
- [ ] Checked TypeScript types (no `any`)

---

## Testing Protected Endpoints

```typescript
// backend/tests/{domain}/{feature}.test.ts
import request from 'supertest';

describe('Protected Endpoint Tests', () => {
  let app: unknown;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    // Get admin token
    const adminAuth = await request(app as any)
      .post('/api/auth/admin')
      .send({ walletAddress: process.env.ADMIN_ADDRESSES?.split(',')[0] });
    adminToken = adminAuth.body.token;

    // Get customer token
    const customerAuth = await request(app as any)
      .post('/api/auth/customer')
      .send({ walletAddress: '0x...' });
    customerToken = customerAuth.body.token;
  });

  it('should reject unauthenticated requests', async () => {
    const response = await request(app as any)
      .post('/api/protected/endpoint')
      .send({ data: 'test' });

    expect(response.status).toBe(401);
  });

  it('should reject insufficient permissions', async () => {
    const response = await request(app as any)
      .post('/api/admin/endpoint')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ data: 'test' });

    expect(response.status).toBe(403);
  });

  it('should allow authorized requests', async () => {
    const response = await request(app as any)
      .post('/api/admin/endpoint')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ data: 'test' });

    expect(response.status).toBe(200);
  });
});
```

---

## Authentication Endpoints

Users authenticate via:
- `/api/auth/admin` - Admin authentication
- `/api/auth/shop` - Shop authentication
- `/api/auth/customer` - Customer authentication

Returns JWT token in response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "address": "0x...",
    "role": "admin"
  }
}
```

---

## Examples

- Customer routes: `backend/src/domains/customer/routes/index.ts`
- Shop subscription: `backend/src/domains/shop/routes/subscription.ts`
- Admin routes: `backend/src/domains/admin/routes/index.ts`
- Token redemption: `backend/src/domains/token/routes/redemptionSession.ts`
