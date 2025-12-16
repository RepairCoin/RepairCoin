# Bug Fix: Promo Code Validation Rate Limiting

**Date:** 2025-12-16
**Priority:** MEDIUM
**Component:** Shop Domain - Promo Codes
**Status:** FIXED

## Issue Description

The public `/promo-codes/validate` endpoints had no rate limiting, allowing attackers to brute-force valid promo codes through enumeration attacks.

### Affected Files
- `backend/src/domains/shop/routes/promoCodes.ts` - Added rate limiting middleware

### Steps to Reproduce (Before Fix)
1. Target a shop's promo code validation endpoint
2. Send thousands of requests with different promo codes
3. Valid codes return `is_valid: true`
4. Attacker discovers all active promo codes

### Expected Behavior
Public endpoints should have rate limiting to prevent enumeration attacks.

### Actual Behavior (Before Fix)
Unlimited requests allowed, enabling brute force code discovery.

## Root Cause

The validation endpoints were public (no authentication required) and had no rate limiting:

```typescript
// Before: No rate limiting
router.post(
  '/:shopId/promo-codes/validate',
  async (req: Request, res: Response) => { ... }
);

router.post(
  '/promo-codes/validate',
  async (req: Request, res: Response) => { ... }
);
```

## Solution

Added rate limiting middleware using the existing `RateLimiter` utility.

### Rate Limit Configuration

```typescript
// 20 attempts per 15 minutes per IP + customer address combination
const promoValidationRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyGenerator: (key: string) => `promo_validate_${key}`
});
```

### Rate Limit Key Strategy

The rate limit key combines IP address and customer address:

```typescript
const promoValidationRateLimit = createRateLimitMiddleware(
  promoValidationRateLimiter,
  (req: Request) => {
    // Rate limit by IP + customer address to prevent enumeration
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const customerAddress = req.body?.customer_address?.toLowerCase() || 'anonymous';
    return `${ip}_${customerAddress}`;
  }
);
```

This approach:
- Prevents same IP from brute-forcing codes for any customer
- Allows legitimate customers from same IP (e.g., shared WiFi) to validate independently
- Uses "anonymous" for requests without customer address

### Applied to Both Endpoints

```typescript
// Shop-scoped endpoint
router.post(
  '/:shopId/promo-codes/validate',
  promoValidationRateLimit,  // ← Rate limit added
  async (req: Request, res: Response) => { ... }
);

// Public endpoint
router.post(
  '/promo-codes/validate',
  promoValidationRateLimit,  // ← Rate limit added
  async (req: Request, res: Response) => { ... }
);
```

## Response Headers

When rate limited, the response includes standard headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed (20) |
| `X-RateLimit-Remaining` | Remaining requests in window |
| `X-RateLimit-Reset` | Unix timestamp when window resets |
| `Retry-After` | Seconds until rate limit resets (when exceeded) |

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 845
}
```

HTTP Status: `429 Too Many Requests`

## Testing

### Run Test
```bash
cd backend && npm test -- --testPathPattern="shop.promo-codes" --testNamePattern="FIXED.*Rate"
```

### Manual Test

```bash
# Send multiple validation requests
for i in {1..25}; do
  curl -X POST http://localhost:4000/api/shops/shop123/promo-codes/validate \
    -H "Content-Type: application/json" \
    -d '{"code": "TEST'$i'", "customer_address": "0x1234..."}'
  echo ""
done

# After 20 requests, should see:
# {"success":false,"error":"Rate limit exceeded","code":"RATE_LIMIT_EXCEEDED","retryAfter":...}
```

### Check Rate Limit Headers

```bash
curl -v -X POST http://localhost:4000/api/shops/shop123/promo-codes/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "TEST", "customer_address": "0x1234..."}'

# Response headers include:
# X-RateLimit-Limit: 20
# X-RateLimit-Remaining: 19
# X-RateLimit-Reset: 1702742400
```

## Configuration

| Parameter | Value | Reason |
|-----------|-------|--------|
| `maxRequests` | 20 | Allows legitimate usage while preventing brute force |
| `windowMs` | 15 minutes | Long enough to deter attackers, short enough for legit retries |
| `key` | IP + customer_address | Prevents bypass via different customer addresses |

### Adjusting Limits

To modify rate limits, edit `backend/src/domains/shop/routes/promoCodes.ts`:

```typescript
const promoValidationRateLimiter = new RateLimiter({
  maxRequests: 30,        // Increase to 30 attempts
  windowMs: 10 * 60 * 1000, // Change to 10 minutes
  keyGenerator: (key: string) => `promo_validate_${key}`
});
```

## Security Benefits

1. **Enumeration Prevention**: Attackers cannot discover valid codes through brute force
2. **Resource Protection**: Prevents DoS through validation endpoint spam
3. **Logging**: Rate limit violations are logged for security monitoring
4. **Per-Customer Isolation**: Legitimate customers from same network aren't affected by each other

## Considerations

### Proxy/Load Balancer
If behind a proxy, ensure `req.ip` returns the real client IP. May need to configure:
- Express: `app.set('trust proxy', true)`
- nginx: Forward `X-Forwarded-For` header

### Shared Networks
The 20 requests per 15 minutes is generous enough for coffee shops or offices where multiple customers might validate codes.

## Related Fixes

- `promo-code-atomic-validation-fix.md` - Bug 1: Atomic validation
- `promo-code-validation-row-locking-fix.md` - Bug 2: Row-level locking
- `promo-code-precision-fix.md` - Bug 3: Percentage calculation precision
- `promo-code-deactivation-race-fix.md` - Bug 4: Deactivation race condition
