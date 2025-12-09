# Bug Fix: Promo Code Race Condition Prevention

**Date:** 2025-12-09
**Priority:** MEDIUM
**Component:** Shop Domain - Issue Reward / Promo Codes
**Status:** FIXED

## Issue Description

Promo code validation and usage recording were separate operations. Concurrent requests could use the same single-use promo code multiple times before either request recorded the usage.

### Affected Files
- `backend/src/repositories/PromoCodeRepository.ts` (new methods added)
- `backend/src/domains/shop/routes/index.ts` (issue-reward endpoint)

### Steps to Reproduce (Before Fix)
1. Create a single-use promo code "BONUS10" with 10 RCN bonus
2. Send two concurrent requests using the same promo code
3. Both requests validate promo code as unused (separate queries)
4. Both requests apply the 10 RCN bonus
5. Both requests attempt to record usage
6. 20 RCN bonus issued instead of 10 RCN

### Expected Behavior
Only the first request should receive the promo bonus.

### Actual Behavior (Before Fix)
Both requests received the bonus, effectively doubling the promotion value.

## Root Cause

The original code performed promo code operations as separate, independent queries:

```typescript
// OLD CODE (Non-atomic operations)

// Step 1: Validate promo code (separate query)
const validation = await promoCodeService.validatePromoCode(code, shopId, customerAddress);

// Step 2: Calculate bonus (separate query)
const bonusResult = await promoCodeService.calculatePromoBonus(code, shopId, customerAddress, baseReward);

// ... reward issuance happens ...

// Step 3: Record promo usage (separate query, much later)
await promoCodeService.recordPromoCodeUse(promoCodeId, customerAddress, shopId, ...);
```

**Timeline of race condition:**
```
Time    Request 1                           Request 2
----    ---------                           ---------
T1      Validate promo: times_used=0 ✓
T2                                          Validate promo: times_used=0 ✓
T3      Calculate bonus: 10 RCN
T4                                          Calculate bonus: 10 RCN
T5      Issue reward (includes 10 RCN)
T6                                          Issue reward (includes 10 RCN)
T7      Record usage: times_used=1
T8                                          Record usage: times_used=2

Result: 20 RCN bonus issued from single-use promo code!
```

## Solution

Implemented `validateAndReserveAtomic()` method that validates AND reserves the promo code usage in a single PostgreSQL transaction with row locking.

### New Method: `PromoCodeRepository.validateAndReserveAtomic()`

```typescript
async validateAndReserveAtomic(
  code: string,
  shopId: string,
  customerAddress: string,
  baseReward: number
): Promise<{
  isValid: boolean;
  errorMessage?: string;
  promoCodeId?: number;
  bonusType?: 'fixed' | 'percentage';
  bonusValue?: number;
  maxBonus?: number;
  bonusAmount: number;
  reservationId?: number;
}> {
  const client = await this.pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Lock promo code row (prevents concurrent access)
    const promo = await client.query(`
      SELECT * FROM promo_codes
      WHERE UPPER(code) = $1 AND shop_id = $2
      FOR UPDATE
    `, [code, shopId]);

    // Step 2: Validate all conditions
    // - is_active check
    // - date range check
    // - total usage limit check
    // - per-customer usage limit check

    // Step 3: Calculate bonus amount

    // Step 4: Reserve usage (increment times_used)
    await client.query(`
      UPDATE promo_codes
      SET times_used = times_used + 1,
          total_bonus_issued = total_bonus_issued + $2
      WHERE id = $1
    `, [promoId, bonusAmount]);

    // Step 5: Record in promo_code_uses table
    const useResult = await client.query(`
      INSERT INTO promo_code_uses (...)
      RETURNING id
    `, [...]);

    await client.query('COMMIT');
    return { isValid: true, reservationId: useResult.rows[0].id, ... };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Rollback Method: `PromoCodeRepository.rollbackReservation()`

If reward issuance fails after promo reservation, this method reverts the promo code usage:

```typescript
async rollbackReservation(
  reservationId: number,
  promoCodeId: number,
  bonusAmount: number
): Promise<void> {
  // Remove the usage record
  await client.query('DELETE FROM promo_code_uses WHERE id = $1', [reservationId]);

  // Decrement the usage count
  await client.query(`
    UPDATE promo_codes
    SET times_used = GREATEST(0, times_used - 1),
        total_bonus_issued = GREATEST(0, total_bonus_issued - $2)
    WHERE id = $1
  `, [promoCodeId, bonusAmount]);
}
```

### Updated Endpoint Flow

```typescript
router.post('/:shopId/issue-reward', async (req, res) => {
  // STEP 1: Atomically validate AND reserve promo code
  const promoCodeRepo = new PromoCodeRepository();
  const atomicResult = await promoCodeRepo.validateAndReserveAtomic(
    promoCode, shopId, customerAddress, rewardBeforePromo
  );

  if (!atomicResult.isValid) {
    return res.status(400).json({ error: atomicResult.errorMessage });
  }

  // Promo is now reserved (times_used incremented, usage recorded)
  const promoReservation = {
    promoCodeId: atomicResult.promoCodeId,
    reservationId: atomicResult.reservationId,
    bonusAmount: atomicResult.bonusAmount
  };

  try {
    // STEP 2: Issue reward atomically
    await shopRepository.issueRewardAtomic(...);

    // Success! Promo usage stays recorded
    return res.json({ success: true, ... });

  } catch (error) {
    // STEP 3: Rollback promo reservation if reward fails
    if (promoReservation) {
      await promoCodeRepo.rollbackReservation(
        promoReservation.reservationId,
        promoReservation.promoCodeId,
        promoReservation.bonusAmount
      );
    }
    return res.status(500).json({ error: 'Reward failed' });
  }
});
```

### How It Prevents Race Conditions

```
Time    Request 1                           Request 2
----    ---------                           ---------
T1      BEGIN transaction
T2      SELECT FOR UPDATE (acquires lock)
T3      Validate: times_used=0 ✓
T4      UPDATE times_used=1
T5      INSERT promo_code_uses
T6      COMMIT (releases lock)
T7                                          BEGIN transaction
T8                                          SELECT FOR UPDATE (acquires lock)
T9                                          Validate: times_used=1 ✗
T10                                         ROLLBACK
T11                                         Return error: "usage limit reached"

Result: Only Request 1 uses the promo code!
```

## Changes Made

### 1. Repository: `PromoCodeRepository.ts`
- Added `validateAndReserveAtomic()` - Atomic validate + reserve in single transaction
- Added `rollbackReservation()` - Reverts reservation if reward fails
- Uses `SELECT FOR UPDATE` for row-level locking
- All validation logic replicated from `validate_promo_code()` SQL function

### 2. Route: `shop/routes/index.ts`
- Added import for `PromoCodeRepository`
- Replaced separate validate/calculate calls with `validateAndReserveAtomic()`
- Added promo reservation rollback in reward error handler
- Removed obsolete `recordPromoCodeUse()` call (now done atomically)

## Testing

### Manual Testing

#### Test 1: Normal Promo Code Usage
```bash
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"customerAddress": "0x...", "repairAmount": 100, "promoCode": "BONUS10"}'
```
**Expected:** Promo bonus applied, usage recorded atomically

#### Test 2: Single-Use Promo Code (Concurrent)
```bash
# Run these simultaneously
curl -X POST ... -d '{"...", "promoCode": "SINGLEUSE"}' &
curl -X POST ... -d '{"...", "promoCode": "SINGLEUSE"}' &
```
**Expected:** First request succeeds, second gets "usage limit reached" error

#### Test 3: Promo Rollback on Reward Failure
```bash
# Use promo with shop that has insufficient balance
curl -X POST http://localhost:4000/api/shops/{lowBalanceShopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"customerAddress": "0x...", "repairAmount": 100, "promoCode": "BONUS10"}'
```
**Expected:** Error returned, promo code usage NOT counted (rolled back)

### Automated Testing

Tests added to `backend/tests/shop/shop.issue-reward.test.ts`:

```typescript
describe('Bug #4 - Promo Code Race Condition', () => {
  it('FIXED: Promo code validation and reservation are now atomic');
  it('FIXED: Concurrent promo code requests are serialized via row locking');
  it('FIXED: Promo reservation is rolled back if reward issuance fails');
});
```

Run tests:
```bash
cd backend && npm test -- --testPathPattern="shop.issue-reward" --testNamePattern="FIXED"
```

## Benefits of the Fix

1. **No Double Usage**: Single-use promo codes can only be used once
2. **Accurate Limits**: Total usage limits are strictly enforced
3. **Per-Customer Limits**: Customer usage limits work correctly with concurrency
4. **Rollback Safety**: Failed rewards don't consume promo code uses
5. **Row-Level Locking**: Minimal impact on other database operations

## Performance Considerations

- Row-level locking only affects the specific promo code row
- Other promo codes can be validated concurrently
- Transaction is short-lived (validation + update only)
- No impact on reward issuance performance

## Rollback Plan

If issues arise, revert to the previous implementation by:
1. Removing `validateAndReserveAtomic()` call from route
2. Restoring separate `validatePromoCode()` and `recordPromoCodeUse()` calls
3. The atomic methods can remain in the repository (unused)

Note: This would re-introduce the race condition vulnerability.
