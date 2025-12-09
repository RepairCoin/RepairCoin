# Bug Fix: Issue Rewards Atomic Transaction Rollback

**Date:** 2025-12-09
**Priority:** HIGH
**Component:** Shop Domain - Issue Reward
**Status:** FIXED

## Issue Description

Transaction recording failure didn't rollback shop balance deduction or customer credit. If the transaction record step failed, the shop lost RCN tokens but the customer received credit with no audit trail.

### Affected Files
- `backend/src/domains/shop/routes/index.ts` (issue-reward endpoint)
- `backend/src/repositories/ShopRepository.ts` (new `issueRewardAtomic()` method)

### Steps to Reproduce (Before Fix)
1. Send POST to `/api/shops/:shopId/issue-reward` with valid payload
2. Shop balance deducted successfully
3. Customer balance credited successfully
4. Transaction recording fails (database error, constraint violation, etc.)
5. Request returns success but transaction is not recorded

### Expected Behavior
All database operations should succeed together or fail together (atomic).

### Actual Behavior (Before Fix)
- Shop balance was deducted (separate operation)
- Customer balance was credited (separate operation)
- Transaction recording could fail silently
- Result: Untracked rewards, accounting discrepancies

## Root Cause

The original code performed database operations as separate, independent transactions:

```typescript
// OLD CODE (Non-atomic operations)
router.post('/:shopId/issue-reward', async (req, res) => {
  // Step 1: Deduct shop balance (own transaction)
  await shopRepository.deductShopBalanceAtomic(shopId, amount);

  // Step 2: Blockchain operations
  const txHash = await processBlockchain(...);

  // Step 3: Update customer (own transaction - SEPARATE!)
  await customerRepository.updateCustomerAfterEarning(customerAddress, amount, tier);

  // Step 4: Record transaction (own transaction - COULD FAIL SILENTLY!)
  try {
    await transactionRepository.recordTransaction({...});
  } catch (txError) {
    logger.error('Failed to record transaction');
    // BUG: Continue anyway - reward already issued!
  }
});
```

**Timeline of failure scenario:**
```
Time    Operation                           Result
----    ---------                           ------
T1      Deduct shop balance                 SUCCESS (committed)
T2      Blockchain mint/transfer            SUCCESS
T3      Credit customer balance             SUCCESS (committed)
T4      Record transaction                  FAILS
T5      Response sent                       "Success" (but no record!)

Result: Shop lost RCN, customer gained RCN, but no transaction record exists
```

## Solution

Implemented `issueRewardAtomic()` method that wraps ALL database operations in a single PostgreSQL transaction with `BEGIN/COMMIT/ROLLBACK`.

### New Method: `ShopRepository.issueRewardAtomic()`

```typescript
async issueRewardAtomic(
  shopId: string,
  customerAddress: string,
  amount: number,
  transactionData: {
    transactionHash: string;
    repairAmount: number;
    baseReward: number;
    tierBonus: number;
    promoBonus: number;
    promoCode: string | null;
    newTier: string;
  }
): Promise<{
  success: boolean;
  shopPreviousBalance: number;
  shopNewBalance: number;
  customerPreviousBalance: number;
  customerNewBalance: number;
  transactionId: string;
}> {
  const client = await this.pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Lock shop row and check/deduct balance
    const shopResult = await client.query(`
      SELECT purchased_rcn_balance FROM shops
      WHERE shop_id = $1 FOR UPDATE
    `, [shopId]);

    // Validate and deduct
    await client.query(`
      UPDATE shops SET purchased_rcn_balance = purchased_rcn_balance - $1 ...
    `, [amount, shopId]);

    // Step 2: Lock customer row and credit balance
    await client.query(`
      SELECT lifetime_earnings FROM customers
      WHERE LOWER(address) = LOWER($1) FOR UPDATE
    `, [customerAddress]);

    await client.query(`
      UPDATE customers SET lifetime_earnings = lifetime_earnings + $1 ...
    `, [amount, customerAddress]);

    // Step 3: Record transaction
    await client.query(`
      INSERT INTO transactions (...) VALUES (...)
    `, [...]);

    // All steps successful - commit
    await client.query('COMMIT');
    return { success: true, ... };
  } catch (error) {
    // ANY failure triggers complete rollback
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Updated Endpoint Flow

```typescript
router.post('/:shopId/issue-reward', async (req, res) => {
  // STEP 1: Blockchain operations FIRST (before any DB changes)
  let transactionHash = `offchain_${Date.now()}`;
  try {
    const transferResult = await tokenMinter.transferTokens(...);
    if (transferResult.success) {
      transactionHash = transferResult.transactionHash;
    }
  } catch (error) {
    // Continue with off-chain tracking
  }

  // STEP 2: ATOMIC DATABASE OPERATIONS
  // All DB changes happen in a single transaction
  try {
    const atomicResult = await shopRepository.issueRewardAtomic(
      shopId,
      customerAddress,
      totalReward,
      { transactionHash, repairAmount, baseReward, tierBonus, promoBonus, promoCode, newTier }
    );

    // Success - all operations committed together
    res.json({
      success: true,
      data: {
        shopNewBalance: atomicResult.shopNewBalance,
        customerNewBalance: atomicResult.customerNewBalance,
        ...
      }
    });
  } catch (atomicError) {
    // Failure - ALL changes rolled back, no partial state
    return res.status(500).json({
      success: false,
      error: 'Failed to process reward - database error (no changes made)'
    });
  }
});
```

### How It Prevents Partial Updates

```
Time    Operation                           Result
----    ---------                           ------
T1      BEGIN transaction                   Started
T2      Lock shop row (FOR UPDATE)          Locked
T3      Deduct shop balance                 Pending (not committed)
T4      Lock customer row (FOR UPDATE)      Locked
T5      Credit customer balance             Pending (not committed)
T6      Record transaction                  FAILS!
T7      ROLLBACK                            ALL changes reverted
T8      Response sent                       "Error - no changes made"

Result: Shop keeps RCN, customer not credited, clean state preserved
```

## Changes Made

### 1. Repository: `ShopRepository.ts`
- Added `issueRewardAtomic()` method
- Uses PostgreSQL `BEGIN/COMMIT/ROLLBACK`
- Implements `SELECT FOR UPDATE` for row-level locking
- Returns comprehensive result with all balance changes

### 2. Route: `shop/routes/index.ts`
- Reordered operations: blockchain FIRST, then DB
- Replaced separate operations with single `issueRewardAtomic()` call
- Updated error handling to reflect atomic behavior
- Response now uses `atomicResult` for accurate balance info

## Testing

### Manual Testing

#### Test 1: Normal Reward Issuance
```bash
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"customerAddress": "0x...", "repairAmount": 100}'
```
**Expected:** All operations succeed atomically

#### Test 2: Insufficient Balance
```bash
# With shop that has 5 RCN, request 15 RCN reward
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"customerAddress": "0x...", "repairAmount": 100}'
```
**Expected:** 400 error, no changes made to any table

#### Test 3: Customer Not Found
```bash
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"customerAddress": "0xinvalid...", "repairAmount": 100}'
```
**Expected:** 404 error, shop balance NOT deducted

### Automated Testing

Tests added to `backend/tests/shop/shop.issue-reward.test.ts`:

```typescript
describe('Bug #3 - Atomic Transaction Rollback', () => {
  it('FIXED: Atomic reward issuance ensures all-or-nothing DB operations');
  it('FIXED: Failed transaction recording triggers complete rollback');
  it('FIXED: Blockchain operations happen before DB changes');
});
```

Run tests:
```bash
cd backend && npm test -- --testPathPattern="shop.issue-reward" --testNamePattern="FIXED"
```

## Benefits of the Fix

1. **Data Integrity**: No partial updates - all changes succeed or all fail
2. **Accurate Balances**: Shop and customer balances always consistent
3. **Audit Trail**: Every reward has a transaction record
4. **Predictable Behavior**: Errors don't leave system in inconsistent state
5. **Better Error Messages**: Clear indication when rollback occurs

## Performance Considerations

- Single database connection for all operations (more efficient)
- Row-level locking prevents race conditions
- Slightly longer transaction time, but ensures consistency
- Connection released immediately after operation (via `finally` block)

## Rollback Plan

If issues arise, revert to the previous implementation by:
1. Reverting the route changes to use separate operations
2. The `issueRewardAtomic()` method can remain (unused) or be removed

Note: The old `deductShopBalanceAtomic()` method is still available for other use cases.
