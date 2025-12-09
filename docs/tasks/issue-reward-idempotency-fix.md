# Bug Fix: Issue Rewards Idempotency Key

**Date:** 2025-12-09
**Priority:** MEDIUM
**Component:** Shop Domain - Issue Reward
**Status:** FIXED

## Issue Description

No idempotency mechanism existed to prevent duplicate reward issuance when clients retry failed/timeout requests. The same reward could be issued multiple times if the client retried a request that had actually succeeded on the server.

### Affected Files
- `backend/src/domains/shop/routes/index.ts` (issue-reward endpoint)
- `backend/src/repositories/IdempotencyRepository.ts` (new)
- `backend/migrations/045_create_idempotency_keys.sql` (new)

### Steps to Reproduce (Before Fix)
1. Send POST to `/api/shops/:shopId/issue-reward` with valid payload
2. Request times out on client side (but succeeds on server)
3. Client retries the same request
4. Reward is issued twice for the same repair

### Expected Behavior
Duplicate request should return original response without re-issuing the reward.

### Actual Behavior (Before Fix)
Reward issued multiple times, causing:
- Customer receives duplicate tokens
- Shop balance deducted multiple times
- Transaction records duplicated

## Root Cause

The original code had no mechanism to detect and handle duplicate requests:

```typescript
// OLD CODE (No duplicate detection)
router.post('/:shopId/issue-reward', async (req, res) => {
  // Every request processed independently
  // No way to detect if this is a retry of a previous request
  const result = await processReward(...);
  res.json(result);
});
```

**Timeline of duplicate issue:**
```
Time    Client                              Server
----    ------                              ------
T1      Send request
T2                                          Process reward (success)
T3      Timeout (no response received)      Send response (lost)
T4      Retry same request
T5                                          Process reward AGAIN (duplicate!)
T6      Receive response                    Send response
```

## Solution

Implemented idempotency key support using PostgreSQL to store and check for duplicate requests.

### New Table: `idempotency_keys`

```sql
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(255) NOT NULL,
    shop_id VARCHAR(255) NOT NULL,
    endpoint VARCHAR(100) NOT NULL DEFAULT 'issue-reward',
    request_hash VARCHAR(64),
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT unique_idempotency_key UNIQUE (idempotency_key, shop_id, endpoint)
);
```

### New Repository: `IdempotencyRepository`

```typescript
class IdempotencyRepository {
  // Check if idempotency key exists and validate request hash
  async checkIdempotencyKey(
    idempotencyKey: string,
    shopId: string,
    requestBody: any,
    endpoint: string = 'issue-reward'
  ): Promise<{ exists: boolean; response?: StoredResponse; hashMismatch?: boolean }>;

  // Store successful response for future duplicate detection
  async storeResponse(
    idempotencyKey: string,
    shopId: string,
    requestBody: any,
    responseStatus: number,
    responseBody: any,
    endpoint: string = 'issue-reward',
    ttlHours: number = 24
  ): Promise<boolean>;

  // Generate SHA256 hash of request body for conflict detection
  hashRequestBody(body: any): string;

  // Clean up expired keys (should run periodically)
  async cleanupExpired(): Promise<number>;
}
```

### Updated Endpoint Flow

```typescript
router.post('/:shopId/issue-reward', async (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'];

  // Step 1: Check for existing response
  if (idempotencyKey) {
    const check = await idempotencyRepository.checkIdempotencyKey(
      idempotencyKey, shopId, req.body
    );

    if (check.exists) {
      if (check.hashMismatch) {
        // Same key, different body = error
        return res.status(422).json({
          error: 'Idempotency key already used with different request parameters'
        });
      }
      // Return cached response
      return res.status(check.response.status).json(check.response.body);
    }
  }

  // Step 2: Process reward normally
  const result = await processReward(...);

  // Step 3: Store response for future duplicates
  if (idempotencyKey) {
    await idempotencyRepository.storeResponse(
      idempotencyKey, shopId, req.body, 200, result
    );
  }

  res.json(result);
});
```

### How It Prevents Duplicates

```
Time    Client                              Server
----    ------                              ------
T1      Send request with key "abc123"
T2                                          Check key: not found
T3                                          Process reward (success)
T4                                          Store response for key "abc123"
T5      Timeout (no response received)      Send response (lost)
T6      Retry with same key "abc123"
T7                                          Check key: FOUND!
T8                                          Return cached response
T9      Receive response                    (No duplicate reward issued)
```

## Changes Made

### 1. Migration: `045_create_idempotency_keys.sql`
- Created `idempotency_keys` table
- Added indexes for fast lookups
- Added cleanup function for expired keys

### 2. Repository: `IdempotencyRepository.ts`
- `checkIdempotencyKey()` - Check for existing response
- `storeResponse()` - Store successful responses (24-hour TTL)
- `hashRequestBody()` - Generate consistent hash for comparison
- `cleanupExpired()` - Remove expired entries

### 3. Route: `shop/routes/index.ts`
- Added import for `idempotencyRepository`
- Added idempotency check at start of endpoint
- Added response storage after successful processing
- Returns 422 for conflicting requests (same key, different body)

## Testing

### Manual Testing

#### Test 1: Normal Request (No Idempotency Key)
```bash
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"customerAddress": "0x...", "repairAmount": 100}'
```
**Expected:** Request processes normally (backward compatible)

#### Test 2: First Request with Idempotency Key
```bash
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -H "X-Idempotency-Key: unique-uuid-12345" \
  -d '{"customerAddress": "0x...", "repairAmount": 100}'
```
**Expected:** Request processes normally, response stored

#### Test 3: Duplicate Request (Same Key)
```bash
# Same request as Test 2
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -H "X-Idempotency-Key: unique-uuid-12345" \
  -d '{"customerAddress": "0x...", "repairAmount": 100}'
```
**Expected:** Returns cached response, NO duplicate reward issued

#### Test 4: Conflicting Request (Same Key, Different Body)
```bash
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -H "X-Idempotency-Key: unique-uuid-12345" \
  -d '{"customerAddress": "0x...", "repairAmount": 200}'  # Different amount!
```
**Expected:** Returns 422 error - "Idempotency key already used with different request parameters"

### Automated Testing

Tests added to `backend/tests/shop/shop.issue-reward.test.ts`:

```typescript
describe('Idempotency Key - Duplicate Prevention', () => {
  it('should process first request normally and store response');
  it('should return cached response for duplicate request with same key');
  it('should reject request with same key but different body (hash mismatch)');
  it('should allow same request body with different idempotency keys');
  it('should allow same key for different shops');
  it('should handle request without idempotency key (backward compatible)');
  it('should expire idempotency keys after TTL');
  it('should generate consistent hash for same request body');
  it('should detect different request bodies with hash comparison');
});

describe('Idempotency Key - Error Scenarios', () => {
  it('should return 422 for conflicting idempotency key usage');
  it('should fail open if idempotency check errors');
  it('should not fail request if idempotency storage fails');
});
```

Run tests:
```bash
cd backend && npm test -- --testPathPattern="shop.issue-reward" --testNamePattern="Idempotency"
```

## Client Implementation

Clients should generate a unique idempotency key for each logical operation:

```typescript
// Frontend example
const issueReward = async (shopId: string, data: RewardData) => {
  const idempotencyKey = crypto.randomUUID(); // Generate unique key

  const response = await fetch(`/api/shops/${shopId}/issue-reward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Idempotency-Key': idempotencyKey  // Include in header
    },
    body: JSON.stringify(data)
  });

  return response.json();
};
```

**Best Practices:**
- Generate a new UUID for each unique operation
- Store the key locally if implementing retry logic
- Reuse the same key when retrying a failed request
- Keys expire after 24 hours

## Performance Considerations

- Idempotency check adds ~1-2ms overhead (indexed lookup)
- Keys stored for 24 hours by default
- Cleanup can be scheduled via cron or called periodically
- Fail-open design: database errors don't block requests

## Cleanup

Expired keys should be cleaned up periodically:

```sql
-- Run via cron or scheduled task
SELECT cleanup_expired_idempotency_keys();
```

Or programmatically:
```typescript
await idempotencyRepository.cleanupExpired();
```

## Rollback Plan

If issues arise, the feature can be disabled by:
1. Removing the idempotency check from the route
2. The endpoint will work normally without the header (backward compatible)

Note: This does not require database rollback as the table is independent.
