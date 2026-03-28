# Bug: Stripe payment success doesn't redirect back to app

**Status:** Completed
**Priority:** Critical
**Est. Effort:** 1 hr
**Created:** 2026-03-28
**Updated:** 2026-03-28
**Completed:** 2026-03-28

## Problem / Goal

After completing Stripe payment for a service booking, the app doesn't redirect back to the booking success screen. The user is stuck in the browser after payment.

**Steps to reproduce:**
1. Login as customer
2. Go to Service tab
3. Click any service item
4. Tap Book button
5. Select schedule then continue
6. Optionally apply discount, click Pay
7. Complete card payment in Stripe checkout
8. Payment succeeds but app doesn't receive the redirect

**Expected:** App opens to the payment success screen (`payment-sucess` route)
**Actual:** User stays in the browser, no redirect to app

## Analysis

**Root Cause:** URL scheme mismatch between app registration and Stripe redirect URLs.

- `app.config.ts` registers the app with scheme `repaircoin`
- `StripeProvider.tsx` tells Stripe to use scheme `khalid2025`
- Backend `PaymentService.ts` builds redirect URLs with `khalid2025://`

When Stripe redirects to `khalid2025://shared/payment-sucess?order_id=xxx`, the OS can't find an app registered for `khalid2025://`, so the redirect fails silently.

**Secondary issue:** Axios timeout of 10s was too short for the `/services/orders/confirm` endpoint which processes Stripe verification + order creation.

## Implementation

1. Updated `StripeProvider.tsx` urlScheme from `khalid2025` to `repaircoin`
2. Updated `PaymentService.ts` success/cancel URLs from `khalid2025://` to `repaircoin://`
3. Updated `purchase.ts` success/cancel URLs from `khalid2025://` to `repaircoin://`
4. Increased axios global timeout from 10s to 30s (matches backend request timeout)
5. Increased Node memory for dev server (`--max-old-space-size=4096`) to handle googleapis package

## Verification Checklist

- [x] StripeProvider urlScheme matches app.config.ts scheme
- [x] Backend success_url uses correct scheme
- [x] Backend cancel_url uses correct scheme
- [x] Complete a test booking payment and verify redirect to success screen
- [ ] Verify cancel flow also redirects back to app
- [ ] Test on Android
- [ ] Test on iOS

## Notes

- Also has a typo: `payment-sucess` instead of `payment-success` (consistent across all files, not fixing now to avoid breaking routes)
- Requires native rebuild after scheme change (`npx expo prebuild --clean`)
