# Bug: Notifications Screen Appears Before Booking Confirmation

## Status: Open
## Priority: Medium
## Date: 2026-04-10
## Category: Bug - Navigation / Payment Flow
## Affected: Customer booking payment (mobile)

---

## Overview

After completing a Stripe payment for a service booking, the Notifications screen briefly appears before the Booking Confirmed screen. The expected flow is: Stripe checkout → directly to Booking Confirmed. Instead the user sees: Stripe checkout → Notifications list → Booking Confirmed.

This interrupts the payment confirmation UX and confuses the user — they momentarily see the notifications list and may think the payment failed or navigated to the wrong screen.

---

## Expected Flow

```
Stripe Checkout (browser) → payment success → redirect back to app → Booking Confirmed screen
```

## Actual Flow

```
Stripe Checkout (browser) → payment success → redirect back to app → Notifications screen (flash) → Booking Confirmed screen
```

---

## Possible Root Causes

### 1. Deep link handling conflict
When the app receives the Stripe success redirect (e.g., `repaircoin://shared/payment-sucess?order_id=xxx`), the deep link might first land on the home screen which triggers a notification update, briefly showing the notifications screen before the payment success handler navigates to the confirmation screen.

### 2. Push notification received during checkout
A booking confirmation notification is sent by the backend immediately after payment succeeds. If the push notification arrives before the deep link redirect, tapping it or its in-app display could navigate to the Notifications screen first.

### 3. WebSocket notification event
The backend sends a WebSocket notification for `booking_confirmed` on payment success. The mobile's WebSocket handler might navigate to the Notifications screen before the payment success screen takes over.

### 4. Navigation race condition
The payment polling/confirmation and the notification listener both try to navigate simultaneously. The notification navigation briefly wins before the payment success navigation replaces it.

---

## Files to Investigate

| File | Purpose |
|------|--------|
| `mobile/app/(dashboard)/shared/payment-sucess/index.tsx` | Payment success screen — how it receives the redirect |
| `mobile/feature/notification/` | Notification handling — does it auto-navigate? |
| `mobile/shared/hooks/useNotifications.ts` | WebSocket notification listener |
| `mobile/app/_layout.tsx` | Deep link configuration |
| `mobile/feature/appointment/hooks/mutations/useBookingMutations.ts` | Stripe checkout success handler |

---

## Fix Options

### Option A: Suppress notification navigation during payment flow
Use a global flag (e.g., `paymentInProgress` in payment store) that blocks notification auto-navigation while a payment is being processed.

### Option B: Delay notification processing
After returning from Stripe, add a brief delay or wait for the payment success screen to mount before processing queued notifications.

### Option C: Prevent notification screen from intercepting deep links
Ensure the deep link handler for `repaircoin://shared/payment-sucess` takes priority over any notification navigation.

---

## QA Test Plan

1. Book a service → proceed to Stripe payment
2. Complete payment in browser
3. App reopens after payment
4. **Before fix**: Notifications screen flashes briefly, then Booking Confirmed shows
5. **After fix**: Booking Confirmed screen shows directly — no notification interruption
