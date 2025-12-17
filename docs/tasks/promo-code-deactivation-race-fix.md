# Bug Fix: Deactivated Code Race Condition (TOCTOU)

**Date:** 2025-12-16
**Priority:** MEDIUM
**Component:** Shop Domain - Promo Codes
**Status:** ALREADY FIXED

## Issue Description

When a shop deactivates a promo code, in-flight validation requests that already read `is_active = true` could potentially still succeed and use the code. This is a Time-of-Check to Time-of-Use (TOCTOU) vulnerability.

### Affected Files
- `backend/src/repositories/PromoCodeRepository.ts` - Contains the fix
- `backend/src/domains/shop/routes/index.ts` - Uses the atomic method

### Steps to Reproduce (Before Fix)
1. Create active promo code "SALE50"
2. Customer starts validation request (UI preview reads `is_active = true`)
3. Shop deactivates "SALE50" (sets `is_active = false`)
4. Customer submits form expecting to use the now-deactivated code

### Expected Behavior
Deactivation should immediately prevent any new usage.

### Actual Behavior (With Fix)
The `validateAndReserveAtomic()` method re-validates `is_active` with a row lock, preventing usage of deactivated codes.

## Root Cause

The original concern was a TOCTOU race condition:

```
Time    Customer Request                    Shop Action
----    ----------------                    -----------
T1      Validate code → is_active=true ✓
T2                                          Deactivate → is_active=false
T3      Submit form with "valid" code
T4      Record usage → ???
```

The question is: does step T4 check `is_active` again?

## Solution (Already Implemented)

The `validateAndReserveAtomic()` method in `PromoCodeRepository.ts` handles this correctly:

### PromoCodeRepository.ts (lines 421-451)

```typescript
async validateAndReserveAtomic(...) {
  const client = await this.pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Lock and fetch promo code with FOR UPDATE
    // This acquires an exclusive lock and reads CURRENT state
    const promoResult = await client.query(`
      SELECT id, code, shop_id, bonus_type, bonus_value, max_bonus,
             start_date, end_date, total_usage_limit, per_customer_limit,
             times_used, is_active
      FROM promo_codes
      WHERE UPPER(code) = $1 AND shop_id = $2
      FOR UPDATE
    `, [normalizedCode, shopId]);

    const promo = promoResult.rows[0];

    // Step 2: RE-VALIDATE is_active after acquiring lock
    // This is the key protection against TOCTOU
    if (!promo.is_active) {
      await client.query('ROLLBACK');
      return {
        isValid: false,
        errorMessage: 'Promo code is not active',  // ← Catches deactivated codes
        promoCodeId: promo.id,
        bonusAmount: 0
      };
    }

    // ... continue with other validations and usage recording ...
  }
}
```

### How It Prevents the Race Condition

```
Time    Customer Request                    Shop Action
----    ----------------                    -----------
T1      Validate (preview) → valid ✓
T2                                          Deactivate → is_active=false
T3      Submit form
T4      validateAndReserveAtomic():
        - BEGIN transaction
        - SELECT ... FOR UPDATE (acquires lock)
        - Read is_active = false (current state!)
        - Return error "Promo code is not active"
T5      Customer sees error, code NOT used
```

The key insight is that `SELECT ... FOR UPDATE`:
1. Acquires an exclusive row lock
2. Reads the **current** committed state of the row
3. Any concurrent deactivation that committed before the lock was acquired will be visible

## Verification

### Code Check

The fix can be verified by examining:

```typescript
// backend/src/repositories/PromoCodeRepository.ts line 443
if (!promo.is_active) {
  await client.query('ROLLBACK');
  return {
    isValid: false,
    errorMessage: 'Promo code is not active',
    ...
  };
}
```

### Usage in Reward Issuance

```typescript
// backend/src/domains/shop/routes/index.ts line 1850
const atomicResult = await promoCodeRepo.validateAndReserveAtomic(
  promoCode.trim(),
  shopId,
  customerAddress,
  rewardBeforePromo
);
```

## Two-Layer Validation

The system has two validation layers:

| Layer | Method | Purpose | Lock Type |
|-------|--------|---------|-----------|
| **Preview** | `validate_promo_code()` SQL function | UI feedback | FOR UPDATE (short-lived) |
| **Usage** | `validateAndReserveAtomic()` | Actual usage | FOR UPDATE (in transaction) |

The **Usage** layer is what matters for preventing actual promo code abuse. Even if the Preview layer returns "valid", the Usage layer will reject deactivated codes.

## Testing

### Run Test
```bash
cd backend && npm test -- --testPathPattern="shop.promo-codes" --testNamePattern="FIXED.*Deactivated"
```

### Manual Test
1. Create promo code "TESTDEACTIVATE"
2. Open Issue Rewards page, enter customer address
3. Type "TESTDEACTIVATE" in promo code field - shows valid
4. In another browser, deactivate "TESTDEACTIVATE"
5. Submit the Issue Rewards form
6. Expected: Error "Promo code is not active"

## Benefits

1. **Immediate Effect**: Deactivation takes effect immediately for new usage attempts
2. **Row Lock Protection**: Prevents concurrent reads of stale data
3. **Atomic Check-and-Use**: Validation and usage are in same transaction
4. **Clear Error Message**: User sees "Promo code is not active"

## Related Fixes

- `promo-code-atomic-validation-fix.md` - Bug 1: Atomic validation
- `promo-code-validation-row-locking-fix.md` - Bug 2: Row-level locking
- `promo-code-precision-fix.md` - Bug 3: Percentage calculation precision
