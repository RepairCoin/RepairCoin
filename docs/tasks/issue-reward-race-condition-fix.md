# Bug Fix: Issue Rewards Race Condition

**Date:** 2025-12-09
**Priority:** HIGH
**Component:** Shop Domain - Issue Reward
**Status:** FIXED

## Issue Description

The balance check and balance deduction in the issue-reward endpoint were performed in separate database operations, allowing concurrent requests to pass validation before either deduction occurs. This could result in negative shop balances.

### Affected Files
- `backend/src/domains/shop/routes/index.ts` (issue-reward endpoint)
- `backend/src/repositories/ShopRepository.ts`

### Steps to Reproduce (Before Fix)
1. Set shop RCN balance to exactly 15 RCN
2. Send two concurrent POST requests to `/api/shops/:shopId/issue-reward`
3. Both requests: `{ customerAddress: "0x...", repairAmount: 100 }` (15 RCN reward each)
4. Both requests pass balance check (15 >= 15)
5. Both deductions succeed, resulting in -15 RCN balance

### Expected Behavior
Second request should fail with insufficient balance error.

### Actual Behavior (Before Fix)
Both requests succeed, shop balance goes negative.

## Root Cause

The original code had a race condition:

```typescript
// OLD CODE (Non-atomic - VULNERABLE)
const shopBalance = shop.purchasedRcnBalance || 0;  // Step 1: Read balance

if (shopBalance < totalReward) {                      // Step 2: Check balance
  return res.status(400).json({ error: 'Insufficient balance' });
}

// ... blockchain operations ...

await shopRepository.updateShop(shopId, {             // Step 3: Deduct balance
  purchasedRcnBalance: shopBalance - totalReward,
});
```

**Timeline of race condition:**
```
Time    Request A                          Request B
----    ---------                          ---------
T1      Read balance: 15
T2                                         Read balance: 15
T3      Check: 15 >= 15 ✓
T4                                         Check: 15 >= 15 ✓
T5      Deduct: 15 - 15 = 0
T6                                         Deduct: 15 - 15 = 0 (uses stale value!)
T7      Final balance: 0                   Final balance: -15 (NEGATIVE!)
```

## Solution

Implemented atomic balance check and deduction using PostgreSQL's `SELECT FOR UPDATE` with transactions.

### New Method: `ShopRepository.deductShopBalanceAtomic()`

```typescript
async deductShopBalanceAtomic(
  shopId: string,
  amount: number,
  additionalTokensIssued: number = 0
): Promise<{ success: boolean; previousBalance: number; newBalance: number }> {
  const client = await this.pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the row and get current balance atomically
    const lockQuery = `
      SELECT purchased_rcn_balance, total_tokens_issued
      FROM shops
      WHERE shop_id = $1
      FOR UPDATE
    `;
    const lockResult = await client.query(lockQuery, [shopId]);

    if (lockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Shop not found');
    }

    const currentBalance = parseFloat(lockResult.rows[0].purchased_rcn_balance || 0);

    // Check if sufficient balance
    if (currentBalance < amount) {
      await client.query('ROLLBACK');
      throw new Error(`Insufficient balance: required ${amount}, available ${currentBalance}`);
    }

    // Deduct balance atomically
    const updateQuery = `
      UPDATE shops
      SET purchased_rcn_balance = purchased_rcn_balance - $1,
          total_tokens_issued = total_tokens_issued + $2,
          last_activity = NOW(),
          updated_at = NOW()
      WHERE shop_id = $3
    `;
    await client.query(updateQuery, [amount, additionalTokensIssued || amount, shopId]);

    await client.query('COMMIT');

    return {
      success: true,
      previousBalance: currentBalance,
      newBalance: currentBalance - amount
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### How It Prevents Race Conditions

```
Time    Request A                              Request B
----    ---------                              ---------
T1      BEGIN
T2      SELECT FOR UPDATE (locks row)
T3      Read balance: 15                       BEGIN
T4      Check: 15 >= 15 ✓                      SELECT FOR UPDATE (BLOCKED - waiting for lock)
T5      UPDATE: balance = 0                    ... waiting ...
T6      COMMIT (releases lock)                 ... waiting ...
T7                                             (lock acquired) Read balance: 0
T8                                             Check: 0 >= 15 ✗
T9                                             ROLLBACK - Insufficient balance!
```

## Changes Made

### 1. ShopRepository.ts
Added new atomic method `deductShopBalanceAtomic()` that:
- Opens a transaction with `BEGIN`
- Locks the shop row with `SELECT ... FOR UPDATE`
- Validates sufficient balance exists
- Deducts balance and updates `total_tokens_issued` in single UPDATE
- Commits on success, rolls back on failure
- Returns previous and new balance for logging

### 2. shop/routes/index.ts (issue-reward endpoint)
- Removed non-atomic balance check (old lines 1707-1744)
- Added call to `deductShopBalanceAtomic()` BEFORE any blockchain operations
- Added proper error handling for insufficient balance errors
- Updated response to use `balanceDeductionResult.newBalance`

## Testing

### Manual Testing

#### Test 1: Normal Reward Issuance
1. Ensure shop has sufficient RCN balance (e.g., 100 RCN)
2. Issue a reward to a customer
3. Verify balance is correctly deducted
4. Verify customer receives tokens

```bash
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"customerAddress": "0x...", "repairAmount": 100}'
```

#### Test 2: Insufficient Balance
1. Set shop balance to 10 RCN
2. Try to issue 15 RCN reward
3. Should return 400 error with "Insufficient shop RCN balance"

#### Test 3: Race Condition Prevention (Concurrent Requests)
1. Set shop balance to exactly 15 RCN
2. Send two concurrent requests for 15 RCN each using a script:

```javascript
// test-race-condition.js
const axios = require('axios');

const API_URL = 'http://localhost:4000';
const SHOP_ID = 'your-shop-id';
const TOKEN = 'your-auth-token';
const CUSTOMER_ADDRESS = '0x...';

async function testRaceCondition() {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    }
  };

  const payload = {
    customerAddress: CUSTOMER_ADDRESS,
    repairAmount: 100  // This gives 15 RCN reward
  };

  // Send two requests simultaneously
  const results = await Promise.allSettled([
    axios.post(`${API_URL}/api/shops/${SHOP_ID}/issue-reward`, payload, config),
    axios.post(`${API_URL}/api/shops/${SHOP_ID}/issue-reward`, payload, config)
  ]);

  console.log('Results:');
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`Request ${index + 1}: SUCCESS - ${JSON.stringify(result.value.data)}`);
    } else {
      console.log(`Request ${index + 1}: FAILED - ${result.reason.response?.data?.error || result.reason.message}`);
    }
  });
}

testRaceCondition();
```

**Expected Result:**
- One request succeeds with balance reduced to 0
- One request fails with "Insufficient shop RCN balance"
- Final shop balance should be 0 (not negative)

#### Test 4: Verify Database Integrity
After running the race condition test, verify in the database:

```sql
SELECT shop_id, purchased_rcn_balance, total_tokens_issued
FROM shops
WHERE shop_id = 'your-shop-id';
```

- `purchased_rcn_balance` should be >= 0 (never negative)
- `total_tokens_issued` should reflect only successful issuances

### Automated Testing

Consider adding to `backend/tests/shop/shop.issue-reward.test.ts`:

```typescript
describe('Issue Reward - Race Condition Prevention', () => {
  it('should prevent negative balance from concurrent requests', async () => {
    // Setup: Create shop with exactly 15 RCN balance
    const shopId = await createTestShop({ purchasedRcnBalance: 15 });
    const customerAddress = '0x1234...';

    // Execute: Send two concurrent 15 RCN reward requests
    const results = await Promise.allSettled([
      issueReward(shopId, customerAddress, 100),
      issueReward(shopId, customerAddress, 100)
    ]);

    // Verify: Exactly one should succeed, one should fail
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Verify: Shop balance should be 0, not negative
    const shop = await getShop(shopId);
    expect(shop.purchasedRcnBalance).toBe(0);
    expect(shop.purchasedRcnBalance).toBeGreaterThanOrEqual(0);
  });
});
```

## Performance Considerations

- The `SELECT FOR UPDATE` lock is held only for the duration of the transaction
- Lock timeout is managed by PostgreSQL's `lock_timeout` setting
- Under high concurrency, requests will queue for the lock rather than fail
- The lock is row-level, so different shops are not affected

## Rollback Plan

If issues arise, revert to the previous non-atomic implementation by:
1. Removing `deductShopBalanceAtomic()` from ShopRepository
2. Restoring the original balance check and `updateShop()` calls in the route

Note: This would reintroduce the race condition vulnerability.
