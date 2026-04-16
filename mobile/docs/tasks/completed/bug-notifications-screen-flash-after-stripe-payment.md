# Bug: Notifications screen flashes after Stripe booking payment

**Status:** Completed
**Priority:** High
**Est. Effort:** 30 minutes
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

After a customer completed a Stripe checkout for a service booking, the app briefly flashed the Notifications screen before navigating to the Booking Confirmed screen. The expected flow is:

```
Stripe Checkout → deep link → Booking Confirmed
```

Actual flow was:

```
Stripe Checkout → deep link → Notifications screen (flash) → Booking Confirmed
```

This interrupted the payment confirmation UX and could make users think the payment had failed or navigated to the wrong place.

## Analysis

### Root cause

`usePushNotifications.ts` registers an `addNotificationResponseReceivedListener`. When the user taps a push notification (or iOS/Android auto-delivers a pending response on app resume), this handler fires and calls `router.push(route)` based on the notification type.

Sequence during a booking payment:

1. User is in Stripe's browser → mobile app is backgrounded.
2. Backend confirms payment → sends a push notification (e.g. `booking_confirmed`, `service_booking_received`).
3. User returns to the app.
4. The OS delivers the notification response → `handleNotificationResponse` fires → `router.push(...)`. Depending on the notification type, this lands on either the service tab or (if the type doesn't match any known case) the default Notifications screen.
5. The deep link `/shared/payment-sucess?order_id=…` resolves → the `PaymentSuccess` route mounts and the success screen renders.

Because step 4 happens before step 5, the first navigation briefly flashes before the Booking Confirmed screen replaces it.

### Why the existing payment session store is the right gate

`usePaymentStore.activeSession` is set at the moment the Stripe checkout URL is opened (in `useCreateStripeCheckoutMutation.onSuccess`) and consumed/cleared on the `PaymentSuccess` screen via `validateAndConsumeSession`. So "active session exists" is a precise signal for "the user is mid-checkout; the deep link will handle routing".

## Implementation

### Files modified

- `mobile/shared/hooks/notification/usePushNotifications.ts`
  - Imported `usePaymentStore`.
  - Added an early return at the top of `handleNotificationResponse`: if `usePaymentStore.getState().activeSession` is non-null, skip navigation and let the deep link to `/shared/payment-sucess` own routing. A console log is emitted for observability.

### Approach

Minimal, surgical guard — one early return inside the existing handler. No changes to the payment flow, notification registration, or deep link wiring. The guard only fires for the short window between opening the Stripe URL and consuming the session on the success screen.

## Verification Checklist

- [x] Customer books a service → taps pay → completes Stripe checkout → returns to app
- [x] Booking Confirmed screen renders directly — no Notifications-screen flash
- [x] Push notifications received after the success screen mounts still route normally (session has already been consumed)
- [x] If the user taps a notification while NOT in a payment flow, navigation still works as before
- [x] Token purchase and subscription checkouts benefit from the same guard (they also set `usePaymentStore.activeSession`)

## Notes

- **Scope of the guard:** only `handleNotificationResponse` navigation is suppressed. `handleNotificationReceived` (foreground notification arrival) is unaffected — it only logs and doesn't navigate, so no change was needed.
- **Future consideration (not in scope):** if/when a WebSocket-based in-app notification listener is added that also auto-navigates, it should apply the same `activeSession` gate to avoid regressing this fix.
