# Bug Fix: max_bonus Not Stored Atomically With Percentage Validation

**Date:** 2025-12-16
**Priority:** LOW
**Component:** Shop Domain - Promo Codes
**Status:** FIXED

## Issue Description

Percentage promo codes could be created without a `max_bonus` cap, allowing unlimited percentage bonuses. For example, a 100% bonus on a $10,000 service could give $10,000 RCN bonus.

### Affected Files
- `backend/migrations/049_add_max_bonus_constraints.sql` - New migration
- `backend/src/services/PromoCodeService.ts` - Added validation

### Steps to Reproduce (Before Fix)
1. Create a promo code with:
   - `bonus_type: 'percentage'`
   - `bonus_value: 100`
   - `max_bonus: null`
2. Customer uses code on expensive service
3. Receives unlimited percentage bonus

### Expected Behavior
Database should enforce that percentage codes require a `max_bonus` cap.

### Actual Behavior (Before Fix)
Database allowed percentage codes without `max_bonus`, risking unlimited bonuses.

## Root Cause

The original code had validation for `bonus_value` but not for `max_bonus`:

```typescript
// Before: No validation for max_bonus
if (data.bonus_type === 'percentage' && (data.bonus_value <= 0 || data.bonus_value > 100)) {
  throw new Error('Percentage bonus must be between 1 and 100');
}
// max_bonus could be null, allowing unlimited bonuses
```

## Solution

Multi-layer protection with both database constraints and service-level validation.

### 1. Database Constraints (049_add_max_bonus_constraints.sql)

```sql
-- Percentage codes must have positive max_bonus
ALTER TABLE promo_codes
ADD CONSTRAINT percentage_requires_max_bonus
CHECK (
  bonus_type != 'percentage' OR
  (bonus_type = 'percentage' AND max_bonus IS NOT NULL AND max_bonus > 0)
);

-- max_bonus cannot exceed 10,000 RCN
ALTER TABLE promo_codes
ADD CONSTRAINT max_bonus_reasonable
CHECK (max_bonus IS NULL OR max_bonus <= 10000);

-- Percentage value must be 1-100
ALTER TABLE promo_codes
ADD CONSTRAINT percentage_bonus_value_valid
CHECK (
  bonus_type != 'percentage' OR
  (bonus_type = 'percentage' AND bonus_value > 0 AND bonus_value <= 100)
);

-- Fixed bonus must be positive
ALTER TABLE promo_codes
ADD CONSTRAINT fixed_bonus_value_positive
CHECK (
  bonus_type != 'fixed' OR
  (bonus_type = 'fixed' AND bonus_value > 0)
);
```

### 2. Service-Level Validation (PromoCodeService.ts)

#### createPromoCode

```typescript
// Validate max_bonus for percentage promo codes (Bug #8 fix)
if (data.bonus_type === 'percentage') {
  if (!data.max_bonus || data.max_bonus <= 0) {
    throw new Error('Percentage promo codes require a positive max_bonus cap');
  }
  if (data.max_bonus > 10000) {
    throw new Error('max_bonus cannot exceed 10,000 RCN');
  }
}

// Validate max_bonus upper bound for all codes (if provided)
if (data.max_bonus !== undefined && data.max_bonus !== null && data.max_bonus > 10000) {
  throw new Error('max_bonus cannot exceed 10,000 RCN');
}
```

#### updatePromoCode

```typescript
// Determine the effective values after update
const effectiveBonusType = updates.bonus_type || promoCode.bonus_type;
const effectiveMaxBonus = updates.max_bonus !== undefined ? updates.max_bonus : promoCode.max_bonus;

// Validate max_bonus for percentage promo codes (Bug #8 fix)
if (effectiveBonusType === 'percentage') {
  if (!effectiveMaxBonus || effectiveMaxBonus <= 0) {
    throw new Error('Percentage promo codes require a positive max_bonus cap');
  }
  if (effectiveMaxBonus > 10000) {
    throw new Error('max_bonus cannot exceed 10,000 RCN');
  }
}
```

### 3. Migration Auto-Fix for Existing Data

```sql
-- Fix existing percentage codes without max_bonus
UPDATE promo_codes
SET max_bonus = LEAST(bonus_value * 100, 10000),
    updated_at = CURRENT_TIMESTAMP
WHERE bonus_type = 'percentage'
  AND (max_bonus IS NULL OR max_bonus <= 0);
```

## How to Apply

### Run Migration
```bash
cd C:\dev\RepairCoin\backend
npx ts-node scripts/run-single-migration.ts migrations/049_add_max_bonus_constraints.sql
```

### Verify Constraints
```sql
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'promo_codes'::regclass
  AND contype = 'c'
ORDER BY conname;

-- Should show:
-- fixed_bonus_value_positive
-- max_bonus_reasonable
-- percentage_bonus_value_valid
-- percentage_requires_max_bonus
```

## Testing

### Run Tests
```bash
cd backend && npm test -- --testPathPattern="shop.promo-codes-max-bonus" --verbose
```

### Test Results
```
PASS tests/shop/shop.promo-codes-max-bonus.test.ts
  Promo Code max_bonus Validation Tests
    createPromoCode Validation
      Percentage Promo Codes
        √ should accept percentage code with valid max_bonus
        √ should reject percentage code without max_bonus
        √ should reject percentage code with null max_bonus
        √ should reject percentage code with zero max_bonus
        √ should reject percentage code with negative max_bonus
        √ should reject percentage code with max_bonus > 10,000
        √ should accept percentage code with max_bonus = 10,000 (boundary)
        √ should accept percentage code with max_bonus = 1 (minimum)
        √ should reject percentage bonus_value > 100
        √ should reject percentage bonus_value = 0
        √ should accept percentage bonus_value = 100 (maximum)
        √ should accept percentage bonus_value = 1 (minimum)
      Fixed Promo Codes
        √ should accept fixed code without max_bonus
        √ should accept fixed code with max_bonus (optional)
        √ should reject fixed code with max_bonus > 10,000
        √ should reject fixed bonus_value = 0
        √ should reject fixed bonus_value < 0
    updatePromoCode Validation
      Updating Percentage Codes
        √ should accept update that keeps valid max_bonus
        √ should accept update that changes max_bonus to valid value
        √ should reject update that sets max_bonus to null
        √ should reject update that sets max_bonus to 0
        √ should reject update that sets max_bonus > 10,000
      Changing Fixed to Percentage
        √ should reject changing to percentage without adding max_bonus
        √ should accept changing to percentage with valid max_bonus
        √ should reject changing to percentage with invalid bonus_value
      Changing Percentage to Fixed
        √ should accept changing to fixed (max_bonus becomes optional)
        √ should accept changing to fixed and removing max_bonus
    Edge Cases
        √ should handle decimal max_bonus values
        √ should handle very small max_bonus values
        √ should reject max_bonus just over limit
    Integration Documentation Tests
        √ FIXED: Percentage codes require max_bonus at creation
        √ FIXED: Percentage codes require max_bonus at update
        √ FIXED: Database constraint enforces max_bonus
        √ FIXED: max_bonus has reasonable upper limit

Test Suites: 1 passed, 1 total
Tests:       34 passed, 34 total
```

### Manual API Test

```bash
# Try to create percentage code without max_bonus (should fail)
curl -X POST http://localhost:4000/api/shops/SHOP_ID/promo-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "code": "TEST50",
    "name": "Test 50%",
    "bonus_type": "percentage",
    "bonus_value": 50,
    "start_date": "2025-01-01",
    "end_date": "2025-12-31"
  }'

# Expected: 400 "Percentage promo codes require a positive max_bonus cap"

# Try with valid max_bonus (should succeed)
curl -X POST http://localhost:4000/api/shops/SHOP_ID/promo-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "code": "TEST50",
    "name": "Test 50%",
    "bonus_type": "percentage",
    "bonus_value": 50,
    "max_bonus": 100,
    "start_date": "2025-01-01",
    "end_date": "2025-12-31"
  }'

# Expected: 201 Created
```

## Validation Rules Summary

| Field | Percentage Code | Fixed Code |
|-------|-----------------|------------|
| `bonus_value` | Required, 1-100 | Required, > 0 |
| `max_bonus` | Required, > 0, ≤ 10,000 | Optional, ≤ 10,000 |

## Error Messages

| Scenario | Error Message |
|----------|---------------|
| Percentage without max_bonus | "Percentage promo codes require a positive max_bonus cap" |
| max_bonus > 10,000 | "max_bonus cannot exceed 10,000 RCN" |
| Percentage bonus_value invalid | "Percentage bonus must be between 1 and 100" |
| Fixed bonus_value invalid | "Fixed bonus must be greater than 0" |

## Security Benefits

1. **Unlimited Bonus Prevention**: Percentage codes must have a cap
2. **Reasonable Upper Limit**: 10,000 RCN maximum prevents extreme bonuses
3. **Defense in Depth**: Both service and database validation
4. **Migration Auto-Fix**: Existing invalid data corrected automatically
5. **Update Validation**: Cannot bypass by updating existing code

## Related Fixes

- `promo-code-atomic-validation-fix.md` - Bug 1: Atomic validation
- `promo-code-validation-row-locking-fix.md` - Bug 2: Row-level locking
- `promo-code-precision-fix.md` - Bug 3: Percentage calculation precision
- `promo-code-deactivation-race-fix.md` - Bug 4: Deactivation race condition
- `promo-code-rate-limiting-fix.md` - Bug 5: Rate limiting
- `promo-code-counter-drift-fix.md` - Bug 6: Counter drift prevention
- `promo-code-address-validation-fix.md` - Bug 7: Address validation
