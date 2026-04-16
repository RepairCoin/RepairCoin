# Bug: Redemption Cross-Shop Limit Uses Lifetime Earnings Instead of Available Balance

**Status:** Open
**Priority:** High
**Est. Effort:** 30 min
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Problem

The shop "Process Redemption" screen calculates the cross-shop 20% limit using the customer's **lifetime earnings** instead of their **available balance**. The backend enforces 20% of available balance. This mismatch allows the shop to enter an amount the UI says is valid, but the backend rejects it.

### Example

Customer earned 1000 RCN lifetime, redeemed 800, current balance = 200. At a cross-shop:

| | Formula | Max RCN | Result |
|---|---|---|---|
| **Mobile redemption (broken)** | 20% of 1000 lifetime earnings | 200 RCN | Shop enters 200, backend rejects |
| **Backend (correct)** | 20% of 200 available balance | 40 RCN | Enforced on server |
| **Mobile booking (correct)** | 20% of 200 available balance | 40 RCN | Already fixed |

---

## Root Cause

### Mobile redemption utility (broken)

**File:** `mobile/feature/redeem-token/utils/calculateMaxRedeemable.ts` (line 48)

```typescript
// Cross-shop: limited to 20% of lifetime earnings ← WRONG
const crossShopLimit = lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;
return Math.min(balance, crossShopLimit);
```

### Mobile customer lookup hook (broken)

**File:** `mobile/feature/redeem-token/hooks/queries/useCustomerLookup.ts` (lines 47-56)

```typescript
// Calculate cross-shop limit (20% of lifetime earnings) ← WRONG
const crossShopLimit = crossShopResponse?.data?.crossShopLimit
  ?? lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;

const maxRedeemable = isHomeShop
  ? balance
  : Math.min(balance, crossShopLimit);  // Uses wrong crossShopLimit
```

### Backend (correct)

**File:** `backend/src/domains/token/services/VerificationService.ts` (lines 108-119)

```typescript
const CROSS_SHOP_REDEMPTION_PERCENTAGE = 0.20;
// Cross-shop: customer can only redeem 20% of their balance ← CORRECT
crossShopLimit = Math.floor(availableBalance * CROSS_SHOP_REDEMPTION_PERCENTAGE * 100) / 100;
maxRedeemable = crossShopLimit;
```

### Mobile booking flow (correct — already fixed)

**File:** `mobile/feature/appointment/screens/AppointmentCompleteScreen.tsx` (line 93)

```typescript
// Uses availableRcn (balance), not lifetimeEarnings ← CORRECT
const crossShopMaxRcn = isHomeShop ? availableRcn : Math.floor(availableRcn * 0.20 * 100) / 100;
```

---

## Fix

### 1. Fix `calculateMaxRedeemable.ts`

**File:** `mobile/feature/redeem-token/utils/calculateMaxRedeemable.ts`

```typescript
// Before (wrong — 20% of lifetime earnings):
const crossShopLimit = lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;
return Math.min(balance, crossShopLimit);

// After (correct — 20% of available balance):
const crossShopLimit = Math.floor(balance * CROSS_SHOP_LIMIT_PERCENTAGE * 100) / 100;
return crossShopLimit;
```

Also update `calculateCrossShopLimit` (line 60-61):

```typescript
// Before:
export function calculateCrossShopLimit(lifetimeEarnings: number): number {
  return lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;
}

// After:
export function calculateCrossShopLimit(balance: number): number {
  return Math.floor(balance * CROSS_SHOP_LIMIT_PERCENTAGE * 100) / 100;
}
```

Update the interface to remove `lifetimeEarnings` dependency (or keep it but don't use it for the limit):

```typescript
interface RedemptionLimitParams {
  balance: number;
  isHomeShop: boolean;
  // lifetimeEarnings no longer needed for limit calculation
}
```

### 2. Fix `useCustomerLookup.ts`

**File:** `mobile/feature/redeem-token/hooks/queries/useCustomerLookup.ts`

```typescript
// Before (wrong):
const crossShopLimit = crossShopResponse?.data?.crossShopLimit
  ?? lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;

// After (correct):
const crossShopLimit = crossShopResponse?.data?.crossShopLimit
  ?? Math.floor(balance * CROSS_SHOP_LIMIT_PERCENTAGE * 100) / 100;
```

### 3. Update comments and docstrings

Update all comments that say "20% of lifetime earnings" to "20% of available balance" in:
- `calculateMaxRedeemable.ts` (lines 6, 47, 55)
- `useCustomerLookup.ts` (lines 7, 47)
- `useRedeemToken.ts` (line 56)
- `types.ts` (line 11)

---

## Files to Modify

| File | Change |
|------|--------|
| `feature/redeem-token/utils/calculateMaxRedeemable.ts` | Change cross-shop limit from `lifetimeEarnings * 0.20` to `balance * 0.20` |
| `feature/redeem-token/hooks/queries/useCustomerLookup.ts` | Change fallback calculation to use `balance` not `lifetimeEarnings` |
| `feature/redeem-token/types.ts` | Update comment on `crossShopLimit` field |
| `feature/redeem-token/hooks/ui/useRedeemToken.ts` | Update comment |

---

## Verification Checklist

- [ ] Customer with 1000 lifetime, 200 balance at cross-shop → max shows 40 RCN (not 200)
- [ ] Customer with 500 lifetime, 100 balance at cross-shop → max shows 20 RCN (not 100)
- [ ] Customer at home shop → max still shows full balance (unchanged)
- [ ] Quick buttons (10, 25, 50, 100) disabled correctly based on new limit
- [ ] MAX button sets to correct cross-shop limit
- [ ] Shop enters max amount → backend accepts (no "Cross-shop limit exceeded" error)
- [ ] Mobile redemption max matches mobile booking max for same customer/shop
- [ ] Compare with web checkout → same max value

---

## Notes

- Same class of bug as the web checkout cross-shop calculation (fixed in `ServiceCheckoutModal.tsx` on 2026-04-16).
- The mobile booking flow (`AppointmentCompleteScreen.tsx`) already uses the correct formula — only the redemption flow is wrong.
- Backend always enforces the correct limit regardless, so no financial risk — but shops see "Cross-shop limit exceeded" errors after entering the amount the UI said was valid.
- The `crossShopResponse?.data?.crossShopLimit` from the API may also return the wrong value if the backend endpoint for that specific call uses lifetime earnings. Verify the `/customers/cross-shop-balance/:address` endpoint returns a limit based on balance, not lifetime earnings.
