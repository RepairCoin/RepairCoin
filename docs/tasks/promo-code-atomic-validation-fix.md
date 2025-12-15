# Bug Fix: Promo Code Validation and Usage Not Atomic

**Date:** 2025-12-15
**Priority:** HIGH
**Component:** Shop Domain - Promo Codes
**Status:** ALREADY FIXED

## Issue Description

Promo code validation and usage recording were originally separate operations. This allowed race conditions where concurrent requests could use the same single-use promo code multiple times before either request recorded the usage.

### Affected Files
- `backend/src/repositories/PromoCodeRepository.ts` - Contains atomic methods
- `backend/src/domains/shop/routes/index.ts` - Issue reward endpoint

### Steps to Reproduce (Before Fix)
1. Create a single-use promo code with `total_usage_limit: 1`
2. Send two concurrent reward issuance requests using the same promo code
3. Both requests validate promo code as unused (separate queries)
4. Both requests apply the bonus
5. Both requests attempt to record usage
6. Double bonus issued from single-use promo code

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

## Solution (Already Implemented)

The fix uses `validateAndReserveAtomic()` method that validates AND reserves the promo code usage in a single PostgreSQL transaction with row locking.

### Method: `PromoCodeRepository.validateAndReserveAtomic()`

Located at `backend/src/repositories/PromoCodeRepository.ts:399-576`

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

If reward issuance fails after promo reservation, this method reverts the usage:

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

### Current Implementation in Issue Reward Endpoint

Located at `backend/src/domains/shop/routes/index.ts:1837-1903`

```typescript
// Calculate promo code bonus if provided
// Uses atomic validation + reservation to prevent race conditions (Bug #4 fix)
let promoBonus = 0;
let promoReservation: { promoCodeId: number; reservationId: number; bonusAmount: number } | null = null;

if (promoCode && promoCode.trim()) {
  try {
    const promoCodeRepo = new PromoCodeRepository();

    // ATOMIC: Validate AND reserve promo code in single transaction
    // This prevents race conditions where concurrent requests could use the same single-use code
    const atomicResult = await promoCodeRepo.validateAndReserveAtomic(
      promoCode.trim(),
      shopId,
      customerAddress,
      rewardBeforePromo
    );

    if (atomicResult.isValid) {
      promoBonus = atomicResult.bonusAmount;
      promoReservation = {
        promoCodeId: atomicResult.promoCodeId!,
        reservationId: atomicResult.reservationId!,
        bonusAmount: atomicResult.bonusAmount
      };
    } else {
      return res.status(400).json({
        success: false,
        error: `Invalid promo code: ${atomicResult.errorMessage}`
      });
    }
  } catch (promoError: any) {
    // Handle error...
  }
}
```

### Rollback on Failure

Located at `backend/src/domains/shop/routes/index.ts:2042-2058`

```typescript
} catch (atomicError: any) {
  // Rollback promo code reservation if reward issuance failed
  if (promoReservation) {
    try {
      const promoCodeRepo = new PromoCodeRepository();
      await promoCodeRepo.rollbackReservation(
        promoReservation.reservationId,
        promoReservation.promoCodeId,
        promoReservation.bonusAmount
      );
      logger.info('Promo code reservation rolled back due to reward failure', {
        reservationId: promoReservation.reservationId,
        promoCodeId: promoReservation.promoCodeId
      });
    } catch (rollbackError) {
      logger.error('Failed to rollback promo code reservation:', rollbackError);
    }
  }
  // ... handle error response
}
```

### Comment Confirming Fix

At line 2111-2112:
```typescript
// Note: Promo code usage is now recorded atomically during validateAndReserveAtomic()
// No separate recordPromoCodeUse call needed (Bug #4 fix)
```

## How It Prevents Race Conditions

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

## Verification

The fix can be verified by checking:

1. **Code uses atomic method:**
   ```bash
   grep -n "validateAndReserveAtomic" backend/src/domains/shop/routes/index.ts
   # Should show line ~1850
   ```

2. **No separate recordPromoCodeUse call:**
   ```bash
   grep -n "recordPromoCodeUse" backend/src/domains/shop/routes/index.ts
   # Should only show comment at line ~2112
   ```

3. **Rollback mechanism exists:**
   ```bash
   grep -n "rollbackReservation" backend/src/domains/shop/routes/index.ts
   # Should show lines ~2046
   ```

## Testing

### Test in Frontend UI

1. **Login as Shop Owner** with active subscription and RCN balance
2. Go to **Shop Dashboard** → **Promo Codes** tab
3. Create a promo code:
   - Code: `TESTATOMIC`
   - Bonus Type: Fixed (e.g., 5 RCN)
   - Max Uses: `1` (single-use)
   - Status: Active
4. Go to **Issue Rewards** tab
5. Enter customer wallet address
6. Select repair type
7. Enter promo code `TESTATOMIC`
8. Click **Issue Reward** → Should succeed
9. Try to use `TESTATOMIC` again → Should fail with "usage limit reached"

### Test via API

```bash
# First request - should succeed
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"customerAddress": "0x...", "repairAmount": 100, "promoCode": "TESTATOMIC"}'

# Second request - should fail
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"customerAddress": "0x...", "repairAmount": 100, "promoCode": "TESTATOMIC"}'
```

## Benefits

1. **No Double Usage**: Single-use promo codes can only be used once
2. **Accurate Limits**: Total usage limits are strictly enforced
3. **Per-Customer Limits**: Customer usage limits work correctly with concurrency
4. **Rollback Safety**: Failed rewards don't consume promo code uses
5. **Row-Level Locking**: Minimal impact on other database operations

## Related Fixes

- `promo-code-validation-row-locking-fix.md` - Row locking for validation preview function
- `issue-reward-race-condition-fix.md` - Atomic reward issuance with balance checks
