# Bug: Notification Preferences — Multiple Issues

## Status: Fixed
## Priority: Medium
## Date: 2026-03-25
## Category: Bug - Notifications / UX
## Location: /shop?tab=settings → Notifications

---

## Overview

The Notification Preferences tab had several UX inconsistencies, an irrelevant toggle, and most preferences were not enforced when actually sending notifications. The preferences saved to the database correctly, but the toggles gave users a false sense of control.

---

## Bug 1: "Password Changes" Toggle Is Irrelevant — FIXED

**Severity:** Low (UX confusion)

RepairCoin uses blockchain wallet authentication — there is no password system. The "Password Changes" toggle under Account & Security had no function.

**Fix Applied:** Relabeled to "Wallet Connection Changes" with description "Alerts when your wallet connection status changes" and changed icon from AlertCircle to Wallet.

**File:** `frontend/src/components/notifications/GeneralNotificationSettings.tsx`

---

## Bug 2: Banner Says "Saved Automatically" But Requires Manual Save — FIXED

**Severity:** Low (UX confusion)

The green info banner stated "Changes are saved automatically" but there was a "Save Changes" button that must be clicked manually.

**Fix Applied:** Changed banner to blue info style with text "Adjust your preferences below and click **Save Changes** to update." — accurately reflects the manual save behavior.

**File:** `frontend/src/components/notifications/GeneralNotificationSettings.tsx`

---

## Bug 3: Most Notification Preferences Are NOT Enforced — FIXED

**Severity:** High (feature gap)

Only 2 consumers checked general notification preferences before sending. All other notification senders ignored them.

**Fix Applied:** Centralized preference check in `NotificationService.createNotification()`:
- Added `NOTIFICATION_PREFERENCE_MAP` mapping notification types to preference fields
- Before creating any notification, checks if the type is preference-gated
- If the user has the preference set to `false`, the notification is suppressed (logged, returns stub)
- System-critical notifications (subscription_approved, shop_suspended/unsuspended, support_*, security_*) are always sent

**Notification types now enforced:**

| Notification Type | Preference Field | User Type |
|---|---|---|
| reward_issued | rewardsEarned | Customer |
| redemption_approval_request | tokenRedeemed | Customer |
| redemption_cancelled | tokenRedeemed | Customer |
| token_gifted | tokenReceived | Customer |
| service_order_completed | orderUpdates | Customer |
| service_payment_failed | orderUpdates | Customer |
| service_order_cancelled | orderUpdates | Customer |
| appointment_reminder | orderUpdates | Customer |
| booking_confirmed | orderUpdates | Customer |
| reschedule_request_approved | orderUpdates | Customer |
| reschedule_request_rejected | orderUpdates | Customer |
| reschedule_request_expired | orderUpdates | Customer |
| booking_rescheduled_by_shop | orderUpdates | Customer |
| service_booking_received | newOrders | Shop |
| reschedule_request_created | newOrders | Shop |
| upcoming_appointment | newOrders | Shop |
| redemption_approved | newOrders | Shop |
| redemption_rejected | newOrders | Shop |
| subscription_paused | subscriptionReminders | Shop |
| subscription_resumed | subscriptionReminders | Shop |
| subscription_cancelled | subscriptionReminders | Shop |
| subscription_self_cancelled | subscriptionReminders | Shop |
| subscription_reactivated | subscriptionReminders | Shop |
| subscription_expiring | subscriptionReminders | Shop |
| low_token_balance | lowTokenBalance | Shop |

**Files Changed:**
- `backend/src/domains/notification/services/NotificationService.ts` — added preference map + check in `createNotification()`
- `backend/src/repositories/GeneralNotificationPreferencesRepository.ts` — added `getPreferencesByAddress()` method

---

## Bug 4: No Change Tracking — Save Button Always Clickable — FIXED

**Severity:** Low (UX)

The Save button was always visible and clickable even when no changes were made.

**Fix Applied:** Added change tracking matching the EmailSettings pattern:
- `originalPreferences` state tracks what was loaded from the API
- `hasChanges` computed via `JSON.stringify` comparison
- Save button only renders when `hasChanges` is true
- After successful save, `originalPreferences` updated to hide the button

**File:** `frontend/src/components/notifications/GeneralNotificationSettings.tsx`

---

## Bug 5: Debug Console.log in API Client — FIXED

**Severity:** Low (cleanup)

`console.log('API Response:', response)` was logging every API response to the browser console.

**Fix Applied:** Removed the debug console.log.

**File:** `frontend/src/services/api/notifications.ts`

---

## All Files Changed

| File | Action |
|------|--------|
| `frontend/src/components/notifications/GeneralNotificationSettings.tsx` | Relabeled password toggle, fixed banner text, added change tracking, Save button conditional |
| `frontend/src/services/api/notifications.ts` | Removed debug console.log |
| `backend/src/domains/notification/services/NotificationService.ts` | Added NOTIFICATION_PREFERENCE_MAP + centralized preference check |
| `backend/src/repositories/GeneralNotificationPreferencesRepository.ts` | Added getPreferencesByAddress() method |

---

## Verification

- [x] "Password Changes" toggle relabeled to "Wallet Connection Changes"
- [x] Banner text matches actual save behavior (manual Save)
- [x] Save button only shows when changes exist
- [x] Notification preference map covers all non-critical notification types
- [x] System-critical notifications (suspended, support, security) always sent
- [x] Suppressed notifications logged with type, receiver, and preference field
- [x] Debug console.log removed from notifications API client
- [x] Preferences persist across page refreshes
- [x] Backend TypeScript compiles with zero errors
- [x] 179 notification tests pass
- [x] 107 password-auth tests pass

---

## Test Results (2026-04-01)

| Test Suite | Tests | Status |
|---|---|---|
| `shop.notification-preferences.test.ts` | 107 | PASS ✅ |
| `shop.email-notifications.test.ts` | 72 | PASS ✅ |
| `shop.password-auth.test.ts` | 107 | PASS ✅ |

---

## QA Test Plan

### Bug 1: Wallet Connection Changes Toggle
1. Go to **Shop Dashboard → Settings → Notifications**
2. Under **Account & Security**, verify toggle says **"Wallet Connection Changes"** (not "Password Changes")
3. Verify description says "Alerts when your wallet connection status changes"
4. Verify icon is a wallet icon (not alert icon)

### Bug 2: Banner Text
1. Same settings page
2. Verify blue info banner says **"Adjust your preferences below and click Save Changes to update"**
3. Verify banner is blue (not green)
4. Verify "Save Changes" text is highlighted in yellow

### Bug 3: Preference Enforcement
1. Toggle OFF **"New Orders"** → Save → Have a customer book a service
2. Verify **no in-app notification** is created for the shop
3. Toggle ON **"New Orders"** → Save → Have a customer book again
4. Verify in-app notification IS created
5. Repeat for "Order Updates" (customer side) — toggle off, complete an order, verify no notification

### Bug 4: Save Button Behavior
1. Load the notification preferences page
2. Verify **no Save button** is visible (no changes made)
3. Toggle any preference
4. Verify **Save button appears**
5. Click Save → verify button disappears after successful save
6. Toggle same preference back and forth to original → verify button disappears (no net change)

### Bug 5: No Debug Logs
1. Open browser DevTools → Console
2. Navigate to notification preferences page
3. Verify no `"API Response:"` log in the console

### Smoke Test (Minimum)
1. Go to Shop Settings → Notifications
2. Confirm "Wallet Connection Changes" label (not "Password Changes")
3. Confirm no Save button until you toggle something
4. Toggle a preference, confirm Save button appears, click it, confirm it disappears
