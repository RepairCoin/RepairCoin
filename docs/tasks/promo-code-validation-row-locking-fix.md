# Bug Fix: Promo Code Validation Row-Level Locking

**Date:** 2025-12-15
**Priority:** HIGH
**Component:** Shop Domain - Promo Codes
**Status:** FIXED

## Issue Description

The `validate_promo_code()` PostgreSQL function checks usage limits without acquiring a row lock, allowing race conditions when multiple customers use the same code simultaneously.

### Affected Files
- `backend/migrations/047_add_row_locking_to_promo_validation.sql` (new migration)
- `backend/migrations/020_migrate_promo_codes_schema.sql` (original function definition)
- `backend/migrations/021_add_max_bonus_to_validation.sql` (previous update)

### Steps to Reproduce (Before Fix)
1. Create promo code with `per_customer_limit: 1`
2. Same customer sends 5 concurrent validation requests
3. All 5 requests read `times_used = 0` before any update
4. All 5 requests pass validation and could potentially use the code

### Expected Behavior
Only one request should succeed per customer when `per_customer_limit: 1`.

### Actual Behavior (Before Fix)
Multiple concurrent requests bypass the per-customer limit because the SELECT query doesn't lock the row.

## Root Cause

The original `validate_promo_code()` function performed a simple SELECT without row locking:

```sql
-- OLD CODE (No locking - vulnerable to race conditions)
SELECT * INTO v_promo
FROM promo_codes
WHERE UPPER(code) = p_code
  AND shop_id = p_shop_id
  AND is_active = true;
```

**Timeline of race condition:**
```
Time    Request 1                           Request 2
----    ---------                           ---------
T1      SELECT promo: times_used=0
T2                                          SELECT promo: times_used=0
T3      Check limit: 0 < 1 ✓ PASS
T4                                          Check limit: 0 < 1 ✓ PASS
T5      Return is_valid=true
T6                                          Return is_valid=true

Result: Both requests validated as valid, bypassing per-customer limit!
```

## Solution

Updated the `validate_promo_code()` PostgreSQL function to use `FOR UPDATE` row-level locking.

### Migration: `047_add_row_locking_to_promo_validation.sql`

```sql
-- Find and LOCK the promo code row to prevent concurrent access
-- FOR UPDATE ensures exclusive lock on this row until transaction ends
SELECT * INTO v_promo
FROM promo_codes
WHERE UPPER(code) = p_code
  AND shop_id = p_shop_id
  AND is_active = true
FOR UPDATE;
```

### How It Prevents Race Conditions

```
Time    Request 1                           Request 2
----    ---------                           ---------
T1      SELECT FOR UPDATE (acquires lock)
T2      times_used=0, check passes
T3                                          SELECT FOR UPDATE (WAITS for lock)
T4      Return is_valid=true
T5      Lock released
T6                                          Lock acquired, reads current state
T7                                          Validation proceeds with accurate data

Result: Requests are serialized, each sees accurate state!
```

## Defense in Depth

This fix complements the existing `validateAndReserveAtomic()` method in `PromoCodeRepository.ts`:

| Layer | Method | Purpose |
|-------|--------|---------|
| **Validation (UI Preview)** | `validate_promo_code()` SQL function | Row lock during validation preview |
| **Usage (Actual Redemption)** | `validateAndReserveAtomic()` | Atomic validation + reservation with row lock |

Both layers now use `FOR UPDATE` locking for comprehensive protection.

## Changes Made

### 1. New Migration: `047_add_row_locking_to_promo_validation.sql`
- Drops and recreates `validate_promo_code()` function
- Adds `FOR UPDATE` to the promo code SELECT query
- Maintains all existing validation logic
- Returns same columns: `is_valid`, `error_message`, `promo_code_id`, `bonus_type`, `bonus_value`, `max_bonus`

## How to Apply

### Run Migration on Windows
```bash
cd C:\dev\RepairCoin\backend
npx ts-node scripts/run-single-migration.ts migrations/047_add_row_locking_to_promo_validation.sql
```

### Run Migration on Unix/Mac
```bash
cd backend
npm run db:migrate
```

## Testing

### Manual Testing

#### Test 1: Normal Promo Code Validation
```bash
curl -X POST http://localhost:4000/api/shops/{shopId}/promo-codes/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"code": "TEST10", "customer_address": "0x..."}'
```
**Expected:** Returns `is_valid: true` with bonus details

#### Test 2: Concurrent Validation Requests
```bash
# Run these simultaneously to test locking
for i in {1..5}; do
  curl -X POST http://localhost:4000/api/shops/{shopId}/promo-codes/validate \
    -H "Content-Type: application/json" \
    -d '{"code": "SINGLEUSE", "customer_address": "0x..."}' &
done
```
**Expected:** Requests are serialized via row locking, each sees accurate usage count

#### Test 3: Per-Customer Limit Enforcement
```bash
# First use the promo code
curl -X POST http://localhost:4000/api/shops/{shopId}/issue-reward \
  -H "Authorization: Bearer {token}" \
  -d '{"customerAddress": "0x...", "repairAmount": 100, "promoCode": "ONCE_PER_CUSTOMER"}'

# Then try to validate again
curl -X POST http://localhost:4000/api/shops/{shopId}/promo-codes/validate \
  -d '{"code": "ONCE_PER_CUSTOMER", "customer_address": "0x..."}'
```
**Expected:** Second validation returns `is_valid: false` with message "You have already used this promo code"

## Benefits of the Fix

1. **Serialized Validation**: Concurrent requests to validate same promo code are serialized
2. **Accurate Usage Counts**: Each validation sees the true current state
3. **Per-Customer Limits Enforced**: Cannot bypass limits with concurrent requests
4. **Total Usage Limits Enforced**: Cannot exceed total usage limit with concurrent requests
5. **Minimal Lock Scope**: Only locks the specific promo code row being validated

## Performance Considerations

- Row-level lock is held only for the duration of the SELECT query
- Other promo codes are not affected (different rows)
- Lock contention only occurs for concurrent requests to the same promo code
- No impact on other database operations

## Rollback Plan

If issues arise, revert by running:

```sql
-- Restore original function without FOR UPDATE
CREATE OR REPLACE FUNCTION validate_promo_code(...)
-- (copy from migration 021_add_max_bonus_to_validation.sql)
```

Note: This would re-introduce the race condition vulnerability.

## Related Fixes

- `issue-reward-promo-code-race-fix.md` - Atomic validation + reservation during reward issuance
- `issue-reward-race-condition-fix.md` - Atomic reward issuance with balance checks
