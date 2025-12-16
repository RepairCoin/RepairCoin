# Bug Fix: Session Expiry Check Not Atomic with Consumption

**Date:** 2025-12-12
**Priority:** LOW
**Component:** Token Domain - RedemptionSessionService
**Status:** FIXED

## Issue Discovered

During security audit, a Time-of-Check to Time-of-Use (TOCTOU) vulnerability was discovered in the session consumption flow.

### Bug: Non-Atomic Expiry Check
- **Expected:** Session expiry should be checked atomically with consumption
- **Actual:** Expiry was checked first, then other validations ran, then session was marked as 'used'
- **Impact:** Race condition could allow expired sessions to be consumed in edge cases

## Vulnerable Code Flow (Before Fix)

**File:** `backend/src/domains/token/services/RedemptionSessionService.ts`

```typescript
// VULNERABLE: Sequential check-then-act pattern
async validateAndConsumeSession(sessionId, shopId, amount) {
  const session = await redemptionSessionRepository.getSession(sessionId);

  // Step 1: Check expiry (TIME = T1)
  if (session.expiresAt < new Date()) {
    throw new Error('Session has expired');
  }

  // ... other validations may take time ...

  // Step 2: Mark as used (TIME = T2, where T2 > T1)
  // RACE CONDITION: Session could expire between T1 and T2!
  await redemptionSessionRepository.updateSessionStatus(sessionId, 'used');

  return session;
}
```

## Attack Scenario

```
Timeline:
  T=0ms    Session expires at T=50ms
  T=40ms   validateAndConsumeSession() called
  T=41ms   Expiry check: 50ms > 40ms -> PASSES (session appears valid)
  T=42ms   Shop validation starts...
  T=48ms   Customer validation starts...
  T=52ms   updateSessionStatus() called
  T=53ms   Session marked as 'used' - BUT IT EXPIRED AT T=50ms!

Result: Expired session was consumed due to TOCTOU race condition
```

## Solution Implemented

### 1. Added Atomic Consumption Method to Repository

**File:** `backend/src/repositories/RedemptionSessionRepository.ts` (lines 340-384)

```typescript
/**
 * Atomically consume a session for redemption
 * Uses a single UPDATE query with all validation conditions to prevent TOCTOU vulnerabilities
 */
async atomicConsumeSession(
  sessionId: string,
  shopId: string,
  amount: number
): Promise<RedemptionSessionData | null> {
  // Single atomic UPDATE with all validation conditions
  // This prevents TOCTOU race conditions by checking expiry AT THE MOMENT of update
  const query = `
    UPDATE redemption_sessions
    SET status = 'used',
        used_at = NOW()
    WHERE session_id = $1
      AND shop_id = $2
      AND status = 'approved'
      AND expires_at > NOW()  -- Atomic expiry check!
      AND used_at IS NULL
      AND max_amount >= $3
    RETURNING *
  `;

  const result = await this.pool.query(query, [sessionId, shopId, amount]);

  if (result.rowCount === 0) {
    return null;  // Validation failed
  }

  return this.mapRowToSession(result.rows[0]);
}
```

### 2. Updated Service to Use Atomic Method

**File:** `backend/src/domains/token/services/RedemptionSessionService.ts` (lines 538-627)

```typescript
async validateAndConsumeSession(sessionId, shopId, amount): Promise<RedemptionSession> {
  // Try atomic consumption first - validates AND consumes in single operation
  const consumedSession = await redemptionSessionRepository.atomicConsumeSession(
    sessionId,
    shopId,
    amount
  );

  if (consumedSession) {
    // Success - session was atomically validated and consumed
    return consumedSession;
  }

  // Atomic consumption failed - fetch session to determine specific error
  const session = await redemptionSessionRepository.getSession(sessionId);

  if (!session) throw new Error('Session not found');
  if (session.shopId !== shopId) throw new Error('Session is for a different shop');
  if (session.status !== 'approved') throw new Error(`Session is ${session.status}, not approved`);
  if (session.usedAt) throw new Error('Session has already been used');
  if (session.expiresAt < new Date()) throw new Error('Session has expired');
  if (amount > session.maxAmount) throw new Error(`Amount exceeds session limit`);

  throw new Error('Session validation failed');
}
```

## Fixed Code Flow (After Fix)

```
Timeline:
  T=0ms    Session expires at T=50ms
  T=40ms   validateAndConsumeSession() called
  T=41ms   atomicConsumeSession() called
  T=42ms   Single UPDATE query executes:
           - status = 'approved' ✓
           - expires_at > NOW() <- checked at T=42ms, 50ms > 42ms ✓
           - used_at IS NULL ✓
           - max_amount >= amount ✓
           - shop_id matches ✓
  T=43ms   Session marked as 'used' ATOMICALLY with expiry check

Alternative (if expired):
  T=52ms   atomicConsumeSession() called
  T=53ms   Single UPDATE query executes:
           - expires_at > NOW() <- checked at T=53ms, 50ms > 53ms ✗ FAILS
  T=54ms   UPDATE affects 0 rows, returns null
  T=55ms   Session fetched to determine error: "Session has expired"
```

## Affected Files
- `backend/src/repositories/RedemptionSessionRepository.ts` (new method added)
- `backend/src/domains/token/services/RedemptionSessionService.ts` (refactored method)
- `backend/tests/shop/shop.redeem.test.ts` (test updated)

## Key Changes

### 1. Single Atomic UPDATE Query
All validation conditions checked in one database operation:
- `status = 'approved'`
- `expires_at > NOW()` - Expiry checked at execution time
- `used_at IS NULL` - Not already consumed
- `max_amount >= requested_amount`
- `shop_id = requested_shop`

### 2. Fallback Error Determination
If atomic update fails (0 rows affected), fetch session to provide specific error message.

## Testing

### Backend Test
```bash
cd backend && npm test -- --testPathPattern="shop.redeem" --testNamePattern="atomic"
# Result: PASS - "FIXED: Session expiry check is now atomic with consumption"
```

### Backend Build
```bash
cd backend && npm run build
# Result: TypeScript compiles without errors
```

## Security Summary

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| Normal consumption | Works | Works |
| Session expires during validation | **Could be consumed (TOCTOU!)** | Correctly rejected |
| Concurrent consumption attempts | Second might succeed | Database prevents |
| High latency between check and use | Vulnerable | Protected |

## Why This Works

PostgreSQL guarantees that the UPDATE query:
1. Acquires a row-level lock on matching rows
2. Evaluates all WHERE conditions atomically
3. Either updates and returns the row, or affects 0 rows

There is no gap between checking `expires_at > NOW()` and setting `status = 'used'` - they happen in the same atomic database operation.

## Performance Impact

- **Before:** 2 database queries (SELECT + UPDATE)
- **After:** 1-2 database queries (atomic UPDATE, optional SELECT on failure)
- **Net:** Same or better performance, with improved security

## Rollback Plan

If issues arise:
1. Revert `validateAndConsumeSession` to use sequential check-then-act pattern
2. Remove `atomicConsumeSession` method from repository (optional)
3. Revert test file changes

## Related Files

- **Repository file:** `backend/src/repositories/RedemptionSessionRepository.ts`
- **Service file:** `backend/src/domains/token/services/RedemptionSessionService.ts`
- **Test file:** `backend/tests/shop/shop.redeem.test.ts`
