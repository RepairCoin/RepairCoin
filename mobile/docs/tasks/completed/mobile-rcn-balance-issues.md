# Bug: Mobile RCN Balance Issues

**Status:** FIXED
**Priority:** HIGH
**Est. Effort:** 3-4 hours
**Created:** 2026-03-10
**Fixed:** 2026-03-11

---

## Problem

Multiple RCN balance display and validation issues in mobile app.

## Related Issues

- RCN shows as 0 in customer lists
- Balance validation issues in rewards
- Purchase max validation not working correctly

## Root Causes & Fixes

### 1. Customer List RCN Display (showing 0)
**File:** `feature/customer/hooks/queries/useCustomerQueries.ts`

**Cause:** Nullish coalescing (`??`) didn't properly distinguish between `0` and `null/undefined` when API returned numeric strings or edge cases.

**Fix:** Added explicit helper functions `getNumericValue()` and `getStringValue()` that check `!== undefined && !== null` before falling back to defaults.

### 2. Stale Balance Validation in Rewards
**Files:** `feature/reward-token/hooks/useShopRewards.ts`, `feature/reward-token/hooks/ui/useRewardToken.ts`

**Cause:** Balance was read from cached `userProfile` in auth store, which was only loaded at login and never refreshed after issuing rewards.

**Fix:** Added `useShopBalance()` hook that fetches real-time balance from API with 30-second stale time and `refetchOnMount: true`. Updated `handleRefresh()` to actually refetch balance.

### 3. Purchase Max Validation Auto-Dismiss
**File:** `feature/buy-token/hooks/ui/useBuyTokenUI.ts`

**Cause:** Error message auto-dismissed after 3 seconds via `setTimeout`, and input was immediately clamped so user couldn't see what they typed.

**Fix:** Removed auto-dismiss timeout. Error now stays visible while input exceeds max. Input shows actual typed value so user understands the error.

## Verification Checklist

- [x] Customer list shows correct RCN balances
- [x] Rewards balance validation works correctly
- [x] RCN purchase max validation enforced properly
