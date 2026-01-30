# Stripe Subscription Period Dates Fix

## Status: Done

## Priority: High

## Type: Bug Fix

## Summary
Next Payment date in shop subscription management was changing every day instead of showing the actual Stripe billing cycle date.

## Problem Description
- **Reported**: Jan 27, 2026
- **Affected Shop**: DC Shopu (and potentially all shops)
- **Symptom**: The "Next Payment" date displayed as "today + 30 days" and changed daily
  - Jan 20: showed 2/19/2026
  - Jan 27: showed 2/26/2026
- **Expected**: Should show fixed date from Stripe (Feb 24, 2026)

## Root Cause
The Stripe API changed how it returns subscription period dates. In newer API versions:
- `current_period_start` and `current_period_end` are **no longer** directly on the subscription object
- These values are now in `subscription.items.data[0].current_period_start/end`

When the code accessed `subscription.current_period_end` and got `undefined`, it triggered the fallback logic:
```typescript
const periodEnd = currentPeriodEnd
  ? new Date(currentPeriodEnd * 1000)
  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Fallback to 30 days from now
```

This caused the "Next Payment" date to always be calculated as "today + 30 days".

## Solution
Updated all code that extracts period dates from Stripe subscriptions to check `items.data[0]` when the values are not directly on the subscription object.

### Files Modified

1. **`backend/src/services/SubscriptionService.ts`**
   - `createSubscription()` - Added items.data[0] fallback
   - `syncSubscriptionFromStripe()` - Added items.data[0] fallback
   - `cancelSubscription()` - Added items.data[0] fallback

2. **`backend/src/domains/shop/routes/webhooks.ts`**
   - Added `extractSubscriptionPeriodDates()` helper function
   - Updated `handleSubscriptionCreated()`
   - Updated `handlePaymentSucceeded()`
   - Updated `updateSubscriptionInDatabase()`
   - Updated checkout session completion handler

3. **`backend/src/domains/shop/routes/subscription.ts`**
   - Updated manual sync route to use items.data[0] fallback

### Code Pattern Used
```typescript
// Extract period dates - check items.data[0] if not directly on subscription (newer Stripe API)
let currentPeriodStart = (subscription as any).current_period_start;
let currentPeriodEnd = (subscription as any).current_period_end;

if (!currentPeriodStart || !currentPeriodEnd) {
  const firstItem = subscription.items?.data?.[0];
  if (firstItem) {
    currentPeriodStart = currentPeriodStart || (firstItem as any).current_period_start;
    currentPeriodEnd = currentPeriodEnd || (firstItem as any).current_period_end;
  }
}
```

## Verification
Confirmed fix against Stripe Dashboard for DC Shopu:
- Stripe shows: Current period Jan 24 to Feb 24, Next invoice Feb 24
- Database updated to: `current_period_end: 2026-02-24T05:47:17.000Z`

## Database Fix Script
Created `backend/scripts/fix-subscription-dates.ts` to correct existing database records with wrong dates.

## Testing Checklist
- [x] TypeScript compilation passes
- [x] Database values match Stripe Dashboard
- [x] Webhook handlers extract dates correctly
- [x] Subscription creation extracts dates correctly
- [x] Subscription sync extracts dates correctly
- [ ] Manual testing in staging environment
- [ ] Monitor production after deployment

## Related Files
- `backend/scripts/fix-subscription-dates.ts` - One-time fix script
- `backend/scripts/check-next-payment-date.ts` - Diagnostic script
- `backend/scripts/investigate-subscription-dates.ts` - Previous investigation

## Notes
- This is a breaking change in the Stripe API that was not documented prominently
- The subscription item ID (`si_*`) contains the period dates, not the subscription itself
- Future Stripe SDK updates may change this again - consider adding logging to detect undefined period dates
