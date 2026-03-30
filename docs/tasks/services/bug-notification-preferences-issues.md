# Bug: Notification Preferences — Multiple Issues

## Status: Open
## Priority: Medium
## Date: 2026-03-25
## Category: Bug - Notifications / UX
## Location: /shop?tab=settings → Notifications

---

## Overview

The Notification Preferences tab has several UX inconsistencies, an irrelevant toggle, and most preferences are not enforced when actually sending notifications. The preferences save to the database correctly, but the toggles give users a false sense of control.

---

## Bug 1: "Password Changes" Toggle Is Irrelevant

**Severity:** Low (UX confusion)

RepairCoin uses blockchain wallet authentication — there is no password system. The "Password Changes" toggle under Account & Security has no function.

**File:** `frontend/src/components/notifications/GeneralNotificationSettings.tsx` (line 310-316)

```typescript
<ToggleSwitch
  label="Password Changes"
  description="Alerts when your password is changed"
  checked={preferences.passwordChanges}
  onChange={() => handleToggle("passwordChanges")}
/>
```

**Fix:** Either remove the toggle entirely, or relabel it to something relevant like "Wallet Connection Changes" or "Account Activity".

---

## Bug 2: Banner Says "Saved Automatically" But Requires Manual Save

**Severity:** Low (UX confusion)

The green info banner states:
> "Your notification preferences are now active. Changes are saved automatically to your account."

But there's a "Save Changes" button in the header that must be clicked manually for changes to persist. This is contradictory.

**File:** `frontend/src/components/notifications/GeneralNotificationSettings.tsx` (lines 248-255)

**Fix options:**
- **Option A:** Remove the banner or change text to "Click Save Changes to update your preferences"
- **Option B:** Implement actual auto-save (debounced PUT on each toggle change) and remove the Save button

---

## Bug 3: Most Notification Preferences Are NOT Enforced

**Severity:** High (feature gap)

Only 2 consumers check general notification preferences before sending:
1. `SubscriptionReminderService.ts` — checks `paymentReminders`
2. `domains/shop/routes/webhooks.ts` — checks some subscription-related prefs

All other notification senders (in-app NotificationService, EventBus handlers, etc.) **do not check** these preferences. The following toggles are saved to DB but never enforced:

| Toggle | Enforced? |
|--------|-----------|
| Platform Updates | No |
| Maintenance Alerts | No |
| New Features | No |
| Login Notifications | No |
| New Orders | No |
| Customer Messages | No |
| Low Token Balance | No |
| Subscription Reminders | **Yes** (SubscriptionReminderService) |
| Promotions | No |
| Newsletter | No |
| Surveys | No |

**Fix:** Each notification sending path needs to check the user's preferences before dispatching. This could be centralized by adding a preference check to the NotificationService or EventBus handlers.

**Note:** This is a similar pattern to the Email Notification Preferences bug documented in `bug-email-preferences-not-enforced.md`. Consider fixing both together.

---

## Bug 4: No Change Tracking — Save Button Always Clickable

**Severity:** Low (UX)

Unlike the Email Settings component which tracks `hasChanges` and only shows Save/Cancel when modifications are detected, the GeneralNotificationSettings component always shows the "Save Changes" button. Users can click Save repeatedly without making any changes.

**File:** `frontend/src/components/notifications/GeneralNotificationSettings.tsx`

**Comparison:**
- `EmailSettings.tsx` — tracks `originalPreferences` vs `preferences` with JSON.stringify, shows Save only on diff
- `GeneralNotificationSettings.tsx` — no change tracking, Save always visible

**Fix:** Add change tracking similar to EmailSettings:
```typescript
const [originalPreferences, setOriginalPreferences] = useState(null);
const hasChanges = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
```

---

## Bug 5: Debug Console.log in API Client

**Severity:** Low (cleanup)

**File:** `frontend/src/services/api/notifications.ts` (line 9)

```typescript
console.log('API Response:', response);
```

This logs every API response to the browser console in production.

**Fix:** Remove the console.log.

---

## Files to Modify

| File | Action |
|------|--------|
| `frontend/src/components/notifications/GeneralNotificationSettings.tsx` | Remove/relabel password toggle, fix banner text, add change tracking |
| `frontend/src/services/api/notifications.ts` | Remove debug console.log |
| `backend/src/services/NotificationService.ts` (or equivalent) | Add preference checks before sending notifications |
| `backend/src/domains/notification/` | Ensure all notification paths check user preferences |

---

## Verification Checklist

- [ ] "Password Changes" toggle removed or relabeled
- [ ] Banner text matches actual save behavior
- [ ] Save button only shows when changes exist (or auto-save implemented)
- [ ] Toggle off "New Orders" → no in-app notification on new order
- [ ] Toggle off "Customer Messages" → no in-app notification on message
- [ ] Toggle off "Platform Updates" → no platform update notifications
- [ ] Debug console.log removed from notifications API client
- [ ] Preferences persist across page refreshes
