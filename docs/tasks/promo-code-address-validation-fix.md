# Bug Fix: Promo Code Address Validation and Normalization

**Date:** 2025-12-16
**Priority:** MEDIUM
**Component:** Shop Domain - Promo Codes
**Status:** FIXED

## Issue Description

Customer Ethereum addresses were validated for format but not normalized to lowercase, potentially allowing case-sensitivity bypass attacks where the same address in different cases could be treated as different customers.

### Affected Files
- `backend/src/domains/shop/routes/promoCodes.ts` - Added validation/normalization helper

### Steps to Reproduce (Before Fix)
1. Use promo code with address `0xABCDef...` (mixed case)
2. Hit max_uses_per_customer limit
3. Try again with `0xabcdef...` (lowercase)
4. If database comparison is case-sensitive, could bypass limit

### Expected Behavior
All addresses should be normalized to lowercase before any database operations.

### Actual Behavior (Before Fix)
Addresses were validated for format but not normalized, relying on downstream code to handle case sensitivity.

## Root Cause

The original validation only checked format without normalization:

```typescript
// Before: Format check only
if (!customer_address || !customer_address.trim()) {
  return res.status(400).json({
    success: false,
    error: 'Customer address is required'
  });
}

// Address passed as-is to service layer
const validation = await promoCodeService.validatePromoCode(
  code,
  shopId,
  customer_address  // Could be mixed case
);
```

## Solution

Added a comprehensive validation and normalization helper function at the route level.

### Helper Function

```typescript
// Helper function to validate Ethereum address format
// Returns true if address matches 0x + 40 hex characters
const isValidEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Helper function to validate and normalize Ethereum address
// Returns normalized (lowercase) address or null if invalid
const validateAndNormalizeAddress = (address: string | undefined | null): string | null => {
  if (!address || typeof address !== 'string') {
    return null;
  }

  const trimmed = address.trim();
  if (!isValidEthereumAddress(trimmed)) {
    return null;
  }

  return trimmed.toLowerCase();
};
```

### Updated Endpoints

#### 1. Shop-Scoped Validation (`/:shopId/promo-codes/validate`)

```typescript
router.post(
  '/:shopId/promo-codes/validate',
  promoValidationRateLimit,
  async (req: Request, res: Response) => {
    const { code, customer_address } = req.body;

    // Validate and normalize customer address
    const normalizedAddress = validateAndNormalizeAddress(customer_address);
    if (!normalizedAddress) {
      return res.status(400).json({
        success: false,
        error: 'Valid Ethereum address is required (0x followed by 40 hex characters)'
      });
    }

    const validation = await promoCodeService.validatePromoCode(
      code,
      shopId,
      normalizedAddress  // Always lowercase
    );
    // ...
  }
);
```

#### 2. Public Validation (`/promo-codes/validate`)

```typescript
router.post(
  '/promo-codes/validate',
  promoValidationRateLimit,
  async (req: Request, res: Response) => {
    const { code, shop_id, customer_address } = req.body;

    // Validate and normalize customer address
    const normalizedAddress = validateAndNormalizeAddress(customer_address);
    if (!normalizedAddress) {
      return res.status(400).json({
        success: false,
        error: 'Valid Ethereum address is required (0x followed by 40 hex characters)'
      });
    }

    const validation = await promoCodeService.validatePromoCode(
      code,
      shop_id,
      normalizedAddress  // Always lowercase
    );
    // ...
  }
);
```

#### 3. Customer Promo History (`/customers/:address/promo-history`)

```typescript
router.get(
  '/customers/:address/promo-history',
  authMiddleware,
  async (req: Request, res: Response) => {
    const { address } = req.params;

    // Validate and normalize address
    const normalizedAddress = validateAndNormalizeAddress(address);
    if (!normalizedAddress) {
      return res.status(400).json({
        success: false,
        error: 'Valid Ethereum address is required (0x followed by 40 hex characters)'
      });
    }

    // Also normalize for ownership check
    if (req.user?.role === 'customer' &&
        req.user.address?.toLowerCase() !== normalizedAddress) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own promo code history'
      });
    }

    const history = await promoCodeService.getCustomerPromoHistory(normalizedAddress);
    // ...
  }
);
```

## Validation Rules

| Check | Rule | Example |
|-------|------|---------|
| Presence | Must not be null/undefined/empty | `""` fails |
| Type | Must be string | `123` fails |
| Format | Must match `^0x[a-fA-F0-9]{40}$` | `0xG...` fails |
| Normalization | Converted to lowercase | `0xABC...` becomes `0xabc...` |

## Error Messages

### Before
```json
{
  "success": false,
  "error": "Customer address is required"
}
```

### After
```json
{
  "success": false,
  "error": "Valid Ethereum address is required (0x followed by 40 hex characters)"
}
```

## Testing

### Run Test
```bash
cd backend && npm test -- --testPathPattern="shop.promo-codes" --testNamePattern="FIXED.*address"
```

### Manual Test

```bash
# Test 1: Invalid format (should fail)
curl -X POST http://localhost:4000/api/shops/shop123/promo-codes/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "SUMMER20", "customer_address": "invalid"}'
# Expected: 400 "Valid Ethereum address is required..."

# Test 2: Valid mixed case (should normalize)
curl -X POST http://localhost:4000/api/shops/shop123/promo-codes/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "SUMMER20", "customer_address": "0xABCDEF1234567890ABCDEF1234567890ABCDEF12"}'
# Expected: 200, address used internally as lowercase

# Test 3: Too short address (should fail)
curl -X POST http://localhost:4000/api/shops/shop123/promo-codes/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "SUMMER20", "customer_address": "0x1234"}'
# Expected: 400 "Valid Ethereum address is required..."
```

## Security Benefits

1. **Case-Sensitivity Bypass Prevention**: Same address in different cases is treated identically
2. **Consistent Database Operations**: All lookups use lowercase, matching stored data
3. **Early Validation**: Invalid addresses rejected before any database operations
4. **Clear Error Messages**: Users understand exact format requirements
5. **Defense in Depth**: Even if downstream code doesn't normalize, route layer ensures it

## Considerations

### Checksum Addresses

Ethereum supports EIP-55 checksum addresses (mixed case for validation). While we accept these, we normalize to lowercase for storage. The original checksum information is not preserved.

If checksum validation is needed in the future:
```typescript
import { getAddress, isAddress } from 'ethers';

const validateWithChecksum = (address: string) => {
  try {
    return getAddress(address); // Returns checksummed version
  } catch {
    return null;
  }
};
```

### Backward Compatibility

Existing records in `promo_code_uses` should already be lowercase (handled by service layer). This fix ensures new validations are consistent.

## Related Fixes

- `promo-code-atomic-validation-fix.md` - Bug 1: Atomic validation
- `promo-code-validation-row-locking-fix.md` - Bug 2: Row-level locking
- `promo-code-precision-fix.md` - Bug 3: Percentage calculation precision
- `promo-code-deactivation-race-fix.md` - Bug 4: Deactivation race condition
- `promo-code-rate-limiting-fix.md` - Bug 5: Rate limiting
- `promo-code-counter-drift-fix.md` - Bug 6: Counter drift prevention
