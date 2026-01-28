# Subscription Days Remaining Calculation Fix

## Status: Done

## Priority: Low

## Type: Bug Fix

## Summary
"Days remaining" for subscription cancellation was showing 1 day more than the actual days left (e.g., 29 days instead of 28 days).

## Problem Description
- **Reported**: Jan 27, 2026
- **Symptom**: Subscription ending on Feb 24, 2026 showed "29 days remaining" on Jan 27, 2026
- **Expected**: Should show "28 days remaining"

## Root Cause
The code used `Math.ceil()` to round up partial days, which incorrectly inflated the count by 1 day.

```typescript
// Before (incorrect)
const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
// 28.5 days → 29 days (wrong)

// After (correct)
const daysRemaining = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
// 28.5 days → 28 days (correct)
```

## Solution
Changed `Math.ceil` to `Math.floor` for "days remaining" calculations to show complete days only.

### Files Modified

1. **`frontend/src/components/shop/CancelledSubscriptionModal.tsx`** (line 25)
   ```typescript
   // Use Math.floor to get complete days remaining (not rounding up partial days)
   const daysRemaining = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
   ```

2. **`frontend/src/components/shop/ShopDashboardClient.tsx`** (line 972)
   ```typescript
   {Math.floor((new Date(shopData?.subscriptionEndsAt!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
   ```

3. **`frontend/src/components/admin/tabs/SubscriptionManagementTab.tsx`** (lines 563-567)
   ```typescript
   // Use Math.floor for days remaining, Math.ceil for expired days
   const diffMs = subscribedTillDate.getTime() - now.getTime();
   const daysRemaining = diffMs >= 0
     ? Math.floor(diffMs / (1000 * 60 * 60 * 24))
     : Math.ceil(diffMs / (1000 * 60 * 60 * 24));
   ```

## Testing Checklist
- [x] TypeScript compilation passes
- [x] Days remaining shows correct count
- [ ] Verify expired subscriptions show correct "X days ago"
- [ ] Test edge cases (same day, 1 day remaining)

## Notes
- For "days remaining" (future date): Use `Math.floor` to show complete days
- For "expired X days ago" (past date): Use `Math.ceil` (via negative number) to show complete days
