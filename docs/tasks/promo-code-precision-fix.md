# Bug Fix: Percentage Calculation Precision

**Date:** 2025-12-16
**Priority:** MEDIUM
**Component:** Shop Domain - Promo Codes
**Status:** FIXED

## Issue Description

JavaScript floating point arithmetic can produce unexpected precision issues when calculating percentage-based promo bonuses, leading to slight over/under issuance of bonus tokens.

### Affected Files
- `backend/src/repositories/PromoCodeRepository.ts`
- `backend/src/services/PromoCodeService.ts`
- `frontend/src/components/shop/tabs/IssueRewardsTab.tsx`

### Steps to Reproduce (Before Fix)
1. Create a percentage-based promo code (e.g., 15.15%)
2. Apply it to a base reward of 33.33 RCN
3. Expected bonus: 5.05 RCN (33.33 * 15.15 / 100 = 5.049445)
4. Actual result: 5.0494449999999995 (floating point imprecision)

### Expected Behavior
Bonus amounts should be rounded to 2 decimal places to match database precision.

### Actual Behavior (Before Fix)
Floating point calculations produced values like `5.0494449999999995` instead of `5.05`.

## Root Cause

JavaScript uses IEEE 754 double-precision floating-point format, which cannot exactly represent all decimal numbers:

```javascript
// Classic floating point issue
0.1 + 0.2 = 0.30000000000000004

// Promo code calculation issue
33.33 * 15.15 / 100 = 5.0494449999999995  // Not exactly 5.049445
```

This mismatches with the database schema which uses `NUMERIC(18,2)` for bonus amounts.

## Solution

Round all bonus calculations to 2 decimal places using `Math.round(value * 100) / 100`.

### Backend Fix: PromoCodeRepository.ts

```typescript
// Before
if (promo.bonus_type === 'fixed') {
  bonusAmount = bonusValue;
} else if (promo.bonus_type === 'percentage') {
  bonusAmount = (baseReward * bonusValue) / 100;
}

// After
if (promo.bonus_type === 'fixed') {
  bonusAmount = Math.round(bonusValue * 100) / 100;
} else if (promo.bonus_type === 'percentage') {
  bonusAmount = Math.round((baseReward * bonusValue) / 100 * 100) / 100;
}
```

### Backend Fix: PromoCodeService.ts

```typescript
// Before
if (validation.bonus_type === 'fixed') {
  bonusAmount = parseFloat(validation.bonus_value as any) || 0;
} else if (validation.bonus_type === 'percentage') {
  bonusAmount = (baseReward * (parseFloat(validation.bonus_value as any) || 0)) / 100;
}

// After
if (validation.bonus_type === 'fixed') {
  bonusAmount = Math.round((parseFloat(validation.bonus_value as any) || 0) * 100) / 100;
} else if (validation.bonus_type === 'percentage') {
  bonusAmount = Math.round((baseReward * (parseFloat(validation.bonus_value as any) || 0)) / 100 * 100) / 100;
}
```

### Frontend Fix: IssueRewardsTab.tsx

```typescript
// Before
if (result.data.bonus_type === "fixed") {
  bonusAmount = parseFloat(result.data.bonus_value) || 0;
} else if (result.data.bonus_type === "percentage") {
  bonusAmount = (rewardBeforePromo * (parseFloat(result.data.bonus_value) || 0)) / 100;
}

// After
if (result.data.bonus_type === "fixed") {
  bonusAmount = Math.round((parseFloat(result.data.bonus_value) || 0) * 100) / 100;
} else if (result.data.bonus_type === "percentage") {
  bonusAmount = Math.round(
    (rewardBeforePromo * (parseFloat(result.data.bonus_value) || 0)) / 100 * 100
  ) / 100;
}
```

## Changes Made

### 1. PromoCodeRepository.ts (validateAndReserveAtomic)
- Added rounding to fixed bonus calculation
- Added rounding to percentage bonus calculation
- Added rounding to max_bonus cap

### 2. PromoCodeService.ts (calculatePromoBonus)
- Added rounding to fixed bonus calculation
- Added rounding to percentage bonus calculation
- Added rounding to max_bonus cap

### 3. IssueRewardsTab.tsx (frontend preview)
- Added rounding to fixed bonus calculation
- Added rounding to percentage bonus calculation
- Added rounding to max_bonus cap

## Testing

### Unit Test
```bash
cd backend && npm test -- --testPathPattern="shop.promo-codes" --testNamePattern="FIXED.*precision"
```

### Manual Test
1. Create promo code with 15.15% bonus
2. Issue reward with base amount of 33.33 RCN
3. Verify bonus shows as 5.05 RCN (not 5.0494449999999995)

### Edge Cases Tested
| Base Reward | Percentage | Expected Bonus | Actual (Rounded) |
|-------------|------------|----------------|------------------|
| 33.33 | 15.15% | 5.05 | 5.05 |
| 100.00 | 10.00% | 10.00 | 10.00 |
| 99.99 | 33.33% | 33.33 | 33.33 |
| 0.01 | 50.00% | 0.01 | 0.01 |

## Benefits

1. **Consistent Values**: Same bonus amount across frontend preview and backend storage
2. **Database Match**: Values match `NUMERIC(18,2)` database precision
3. **No Token Drift**: Prevents accumulation of tiny over/under payments over time
4. **User Trust**: Displayed values match actual values issued

## Performance Considerations

- `Math.round()` is a native JavaScript function with negligible performance impact
- No additional database queries required
- Calculation happens inline with existing logic

## Related Fixes

- `promo-code-atomic-validation-fix.md` - Bug 1: Atomic validation
- `promo-code-validation-row-locking-fix.md` - Bug 2: Row-level locking
