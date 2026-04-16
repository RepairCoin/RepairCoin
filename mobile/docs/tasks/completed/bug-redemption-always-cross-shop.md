# Bug: Mobile redemption always treated as cross-shop

**Status:** Completed
**Priority:** Critical
**Est. Effort:** 30 minutes
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

The mobile shop "Process Redemption" screen always showed "Cross-Shop Redemption" even when the customer's home shop was processing the redemption. This capped the maximum redeemable to 20% instead of 100%, making the feature unusable for home-shop redemptions.

**Example:** Customer "Qua Ting" at shop "Peanut" (their home shop, 23 earning transactions confirmed in DB) saw a `~4 RCN` cross-shop limit on mobile, while web correctly allowed full balance redemption.

## Analysis

### Root Cause

**File:** `mobile/feature/redeem-token/hooks/queries/useCustomerLookup.ts` (line 40)

```typescript
shopData?.id ? customerApi.hasEarnedAtShop(address, shopData.id) : Promise.resolve(false)
```

`shopData?.id` was always `undefined` because the shop profile object returned from `/shops/wallet/:address` has no `id` field — the correct field is `shopId`.

Since `undefined` is falsy, the ternary always resolved to `Promise.resolve(false)`, making `isHomeShop = false` for every shop. Every mobile redemption was incorrectly treated as cross-shop.

The same wrong reference appeared on line 28 in the `useEffect` dependency array.

### Impact

Every mobile redemption since the feature shipped has been incorrectly capped at 20% of lifetime earnings. Shops processing redemptions for their own customers were limited to 20% when they should have had 100%.

The web does not share this issue — it uses a different code path (`noShowStatus.isHomeShop`) for home shop detection.

Backend `VerificationService` always enforces the correct limit, so there was no risk of over-redemption; the bug only blocked valid home-shop redemptions.

### Secondary Issue (not fixed in this task)

`customerApi.hasEarnedAtShop()` in `mobile/shared/services/customer.services.ts` fetches only the last 100 transactions. For customers with 100+ transactions at shops other than their home shop, the check could still incorrectly return `false`. Not reproduced in this report (test customer had 23 transactions), so deferred.

## Implementation

### Files Modified

- `mobile/feature/redeem-token/hooks/queries/useCustomerLookup.ts`
  - Line 28: `shopData?.id` → `shopData?.shopId` (useEffect dependency)
  - Line 40: `shopData?.id` → `shopData?.shopId` (home shop check)

### Approach

Minimal, targeted fix — corrected the wrong field name in both locations. Did not change `hasEarnedAtShop` behavior or introduce a new API call to keep the fix scoped to the reported regression.

## Verification Checklist

- [x] Customer at home shop → "Home Shop" badge (green) shown
- [x] Customer at home shop → max redeemable = 100% of balance
- [x] Customer at cross-shop → "Cross-Shop Redemption" badge (amber) shown
- [x] Customer at cross-shop → max redeemable = 20% of balance
- [x] Mobile badge matches web for same customer/shop combination
- [ ] Customer with 100+ transactions at home shop → home shop still correctly detected (deferred — see Notes)
- [x] Shop with `shopId` containing special characters → still works (no encoding change)

## Notes

- **Test case:** Process a redemption with customer "Qua Ting" at shop "Peanut". Should now show "Home Shop" badge and allow full balance redemption.
- **Regression areas to sanity-check:**
  - Cross-shop redemption (different shop) still shows 20% cap correctly.
  - `customerAddress` + `shopId` change both trigger the lookup effect.
- **Follow-up (not in scope):** Replace client-side `hasEarnedAtShop` with a server-side call (e.g., `GET /api/tokens/verify-redemption` or `GET /customers/:address/no-show-status`) to eliminate the 100-transaction limit and reduce payload size. Both endpoints already return `isHomeShop`.
