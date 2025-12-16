# Bug Fix: No Rate Limiting on Session Creation

**Date:** 2025-12-12
**Priority:** MEDIUM
**Component:** Token Domain - RedemptionSessionService
**Status:** FIXED

## Issue Discovered

During security audit, a DoS vulnerability was discovered in the redemption session creation system.

### Bug: No Rate Limiting on Session Creation
- **Expected:** Session creation should be rate-limited to prevent abuse
- **Actual:** Unlimited session creation allowed, enabling database flooding attacks
- **Impact:** Database bloat, potential service degradation, resource exhaustion

## Vulnerable Code

**File:** `backend/src/domains/token/services/RedemptionSessionService.ts`

```typescript
// VULNERABLE: No rate limiting check before creating sessions
async createRedemptionSession(params: CreateSessionParams): Promise<RedemptionSession> {
  const { customerAddress, shopId, amount } = params;

  // ... validation checks ...

  // Check for existing pending sessions
  const existingSession = await redemptionSessionRepository.findPendingSessionForCustomer(customerAddress, shopId);
  if (existingSession) {
    throw new Error('A pending redemption session already exists');
  }

  // NO RATE LIMITING - attacker can create unlimited sessions
  // Create new session
  const sessionId = crypto.randomUUID();
  // ...
}
```

## Attack Scenario

```
1. Malicious shop obtains list of customer addresses
2. Loop through customers, creating session for each:
   - Create session for Customer A at Shop X
   - Wait for session to expire (5 min) or be rejected
   - Repeat immediately, creating thousands of sessions
3. Database fills with redemption session records
4. Query performance degrades across entire platform
5. Service becomes slow or unresponsive
```

## Solution Implemented

### 1. Added Rate Limiting Method to Repository

**File:** `backend/src/repositories/RedemptionSessionRepository.ts`

```typescript
/**
 * Count recent sessions created for a specific shop and customer within a time window
 * Used for rate limiting to prevent DoS attacks
 * @param shopId Shop ID
 * @param customerAddress Customer wallet address
 * @param minutes Time window in minutes
 * @returns Count of sessions created within the time window
 */
async countRecentSessionsByShopForCustomer(
  shopId: string,
  customerAddress: string,
  minutes: number
): Promise<number> {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM redemption_sessions
      WHERE shop_id = $1
      AND customer_address = $2
      AND created_at > NOW() - INTERVAL '1 minute' * $3
    `;

    const result = await this.pool.query(query, [
      shopId,
      customerAddress.toLowerCase(),
      minutes
    ]);

    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Error counting recent sessions for rate limiting:', {
      shopId,
      customerAddress,
      minutes,
      error
    });
    throw new Error('Failed to count recent sessions');
  }
}
```

### 2. Added Rate Limiting Check to Service

**File:** `backend/src/domains/token/services/RedemptionSessionService.ts` (lines 95-114)

```typescript
// Check for existing pending sessions
const existingSession = await redemptionSessionRepository.findPendingSessionForCustomer(customerAddress, shopId);
if (existingSession) {
  throw new Error('A pending redemption session already exists');
}

// Rate limiting: Prevent DoS by limiting session creation frequency
const RATE_LIMIT_WINDOW_MINUTES = 5;
const MAX_SESSIONS_PER_WINDOW = 5;

const recentSessionCount = await redemptionSessionRepository.countRecentSessionsByShopForCustomer(
  shopId,
  customerAddress,
  RATE_LIMIT_WINDOW_MINUTES
);

if (recentSessionCount >= MAX_SESSIONS_PER_WINDOW) {
  logger.warn('Rate limit exceeded for session creation', {
    customerAddress,
    shopId,
    recentSessionCount,
    limit: MAX_SESSIONS_PER_WINDOW,
    windowMinutes: RATE_LIMIT_WINDOW_MINUTES
  });
  throw new Error(`Rate limit exceeded. Maximum ${MAX_SESSIONS_PER_WINDOW} sessions per ${RATE_LIMIT_WINDOW_MINUTES} minutes.`);
}

// Create new session
const sessionId = crypto.randomUUID();
```

## Affected Files
- `backend/src/repositories/RedemptionSessionRepository.ts` (new method added)
- `backend/src/domains/token/services/RedemptionSessionService.ts` (rate limit check added)
- `backend/tests/shop/shop.redeem.test.ts` (test updated)

## Rate Limiting Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `RATE_LIMIT_WINDOW_MINUTES` | 5 | Time window for counting sessions |
| `MAX_SESSIONS_PER_WINDOW` | 5 | Maximum sessions allowed per window |

This means a shop can create at most 5 sessions for a specific customer within any 5-minute window.

## Verification Scenarios

### Test 1: Normal Usage (Should Pass)
```
Shop creates 3 sessions for Customer A in 5 minutes
-> All 3 sessions created successfully
-> recentSessionCount = 3, limit = 5
```

### Test 2: Rate Limit Exceeded (Should Block)
```
Shop creates 5 sessions for Customer A in 5 minutes
-> Sessions 1-5 created successfully
-> Session 6 attempt:
   -> recentSessionCount = 5, limit = 5
   -> Error: "Rate limit exceeded. Maximum 5 sessions per 5 minutes."
```

### Test 3: Rate Limit Reset After Window
```
Shop creates 5 sessions for Customer A at 10:00
-> Wait until 10:05 (window expires)
-> Shop creates new session for Customer A
-> Success! Previous sessions outside window
```

## Testing

### Backend Test
```bash
cd backend && npm test -- --testPathPattern="shop.redeem" --testNamePattern="Rate limiting"
# Result: PASS - "FIXED: Rate limiting implemented on session creation"
```

### Backend Build
```bash
cd backend && npm run build
# Result: TypeScript compiles without errors
```

## Security Summary

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| 5 sessions in 5 min | Allowed | Allowed |
| 6+ sessions in 5 min | **Allowed (vulnerability!)** | Blocked |
| Sessions after window expires | Allowed | Allowed |
| Rapid session spam | **Possible DoS attack** | Rate limited |

## Why This Configuration?

- **5 sessions per 5 minutes** is generous for legitimate use:
  - Normal shops create 1-2 sessions at a time
  - Allows for retries if customer rejects/expires
  - Prevents abuse without impacting normal operations

- **Per shop-customer combination**:
  - Different customers are not affected by each other
  - Different shops can each create sessions for same customer
  - Limits scope of any single shop's abuse potential

## Rollback Plan

If issues arise:
1. Remove rate limiting check from `RedemptionSessionService.ts` (lines 95-114)
2. Remove `countRecentSessionsByShopForCustomer` method from repository (optional)
3. Revert test file changes

## Related Files

- **Service file:** `backend/src/domains/token/services/RedemptionSessionService.ts`
- **Repository file:** `backend/src/repositories/RedemptionSessionRepository.ts`
- **Test file:** `backend/tests/shop/shop.redeem.test.ts`
