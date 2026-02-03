# Bug: DC Shopuo Subscription Shows "Network Error"

## Status: Investigating
## Priority: Medium
## Date: February 3, 2026
## Shop: DC Shopuo (dc_shopu) - deobernard@yahoo.com

## Description

Shop settings subscription page shows "Network Error" and "No Active Subscription" even though admin panel shows the shop as Active with next payment 2/24/2026.

## Root Cause

**Stripe API timeout** — not related to subscription guard changes from yesterday.

Backend logs show:
```
[error]: Failed to sync subscription from Stripe {
  "stripeSubscriptionId": "sub_1SWscNL8hwPnzzXkX4QoooJ",
  "error": "Query read timeout"
}
[error]: Failed to sync subscription with Stripe, using cached data {
  "shopId": "dc_shopu",
  "error": "Query read timeout"
}
[info]: BACKEND - SUBSCRIPTION STATUS: TRUE - Active subscription found for shop: {
  "shopId": "dc_shopu",
  "status": "active",
  "cancelAtPeriodEnd": false,
  "currentPeriodEnd": "2026-02-24T05:47:17.000Z"
}
[error]: Error syncing next_payment_date from Stripe
```

The backend correctly falls back to cached data and finds the active subscription. The "Network Error" on the frontend was caused by:
1. Backend not running at time of page load, OR
2. Stripe API timeout causing overall request to exceed the 30-second request timeout

## Verification

Yesterday's subscription guard changes (commit cdbc22f8) did NOT modify:
- `SubscriptionManagement.tsx` (the settings subscription component)
- `SubscriptionService.ts` (backend subscription service)
- `subscription.ts` routes (backend subscription endpoints)

The changes only affected:
- `useSubscriptionStatus.ts` — pending vs suspended detection logic
- `SubscriptionGuard.tsx` — pending state UI theming

## Fix

The Stripe timeout issue is intermittent. The backend already has fallback logic (line 187-194 in subscription.ts).

Resolution: Restart backend server and refresh the page. The cached subscription data will be returned.

## E2E Testing Checklist

- [ ] Start backend server (`cd backend && npm run dev`)
- [ ] Verify health: `curl http://localhost:4000/api/health`
- [ ] Log in as dc_shopu (deobernard@yahoo.com)
- [ ] Navigate to Settings > Subscription
- [ ] Verify "Monthly Subscription" shows Active status with $500/month
- [ ] Verify next payment date shows 2/24/2026
- [ ] Verify no "Network Error" banner
- [ ] Click "Sync Status" button — should complete without error
- [ ] Navigate to other tabs and back to verify subscription persists
- [ ] Check admin panel still shows dc_shopu as Active
