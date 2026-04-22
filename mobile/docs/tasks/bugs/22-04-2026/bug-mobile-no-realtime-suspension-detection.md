# Bug: Mobile Shop App Has No Real-Time Suspension Detection

**Status:** Open
**Priority:** High
**Est. Effort:** 2-3 hrs
**Created:** 2026-04-22
**Updated:** 2026-04-22

---

## Problem / Goal

When an admin suspends a shop from the web dashboard, the mobile app does **not** detect the change in real-time. The suspended shop continues to see the active dashboard and can keep transacting until they:

- Manually tap the "Check Status" button on the Suspended screen (only visible if they happen to be on that screen)
- Log out and log back in
- Kill and restart the app

On the web frontend this is instant — `frontend/src/hooks/useNotifications.ts` listens for a `shop_status_changed` WebSocket event and force-refreshes the shop state. Mobile has no equivalent.

**User impact:** a shop suspended for fraud or policy violation can continue issuing rewards, creating bookings, and accepting payments on mobile for as long as they keep the app open — minutes to hours depending on session length. This is a trust/compliance hole.

---

## Analysis

### What's already in place

- **Suspended screen is correctly routed at login time** — see commit `d1335518` and the now-completed parent task `mobile/docs/tasks/bugs/15-04-2026/bug-suspended-shop-shows-pending-screen-no-realtime.md` (Issue 1 only)
- **Backend already emits a suspension email** via `EmailService.sendShopSuspendedByAdmin` — proves the suspension event is fully observable server-side
- **Backend already has Expo push infrastructure** — `backend/src/services/ExpoPushService.ts`, `PushNotificationDispatcher.ts`, `PushTokenRepository.ts`, `NotificationDomain`. No new backend primitives required, just a new notification type.
- **Mobile has push-token registration** — the NotificationDomain already knows how to deliver to mobile. Mobile just needs a handler for a new type.

### Why the real-time path was skipped in the prior fix

Per commit message on `d1335518`:
> "Real-time suspension detection (WebSocket/push) was out of scope; the manual Check Status button covers the common case."

That was a deliberate scope cut — the screen-routing bug (Issue 1) was higher priority and the "Check Status" button was shipped as a workaround.

### Why WebSocket is NOT the right approach for mobile

- Mobile has **no WebSocket connection at all**. `socket.io-client` appears in `mobile/package-lock.json` only as a transitive dependency; it is not in `mobile/package.json` direct deps and has zero imports in mobile source.
- Building mobile WebSocket infrastructure from scratch is ~4-6 hrs per `mobile/docs/tasks/enhancements/websocket-realtime-messaging.md` and solves multiple problems, not just suspension. That's a separate, larger scope.
- **Push notifications are already wired and appropriate for this event type.** Suspension is a one-shot lifecycle event, not a stream — push fits cleanly.

### Recommended approach — Option A (push notification handler)

1. Backend emits `shop_suspended` and `shop_unsuspended` push notifications via existing `PushNotificationDispatcher` / `ExpoPushService` when admin suspension/unsuspension happens
2. Mobile registers a notification handler for these types (alongside existing handlers)
3. On receiving `shop_suspended`: clear shop session state, navigate to `/register/suspended`
4. On receiving `shop_unsuspended`: refresh shop data, allow dashboard re-entry

Falls back gracefully: if push is disabled at OS level, the prior "Check Status" button still works.

### Rejected alternatives

| Option | Why rejected |
|---|---|
| **WebSocket (matches web)** | No mobile WebSocket infra; 4-6 hr scope expansion; overkill for a one-shot event |
| **Periodic polling (setInterval every 60s)** | Battery/network waste; 60s lag still feels slow; worse UX than push |

---

## Implementation

### Backend (~1 hr)

**Files to modify / add:**

| File | Change |
|---|---|
| `backend/src/domains/admin/controllers/*` (wherever admin suspend/unsuspend happens) | After the DB update, dispatch a push notification via `PushNotificationDispatcher` targeting the shop's registered push tokens |
| `backend/src/services/PushNotificationDispatcher.ts` or similar | Add `shop_suspended` and `shop_unsuspended` notification types with appropriate title/body |

Verify the admin suspension flow by grepping for `sendShopSuspendedByAdmin` (the email already fires at the right place — add the push call alongside it).

Notification payload should include:
```json
{
  "type": "shop_suspended",
  "shopId": "...",
  "reason": "...",
  "suspendedAt": "2026-04-22T..."
}
```

### Mobile (~1-2 hrs)

**Files to create / modify:**

| File | Change |
|---|---|
| `mobile/shared/hooks/notification/useNotificationHandler.ts` (or wherever existing push handlers live) | Add handlers for `shop_suspended` and `shop_unsuspended` notification types |
| `mobile/shared/hooks/auth/useAuth.ts` | Expose a `markSuspended(reason, suspendedAt)` and `markUnsuspended()` action the handler can call, or have the handler `router.replace` directly + update the auth store |
| `mobile/shared/store/auth.store.ts` (if exists) | Ensure suspended state can be set imperatively, not only at login |

**Handler behavior:**

```ts
// shop_suspended
// - Update auth store: mark shop as suspended with reason + timestamp
// - router.replace('/register/suspended')
// - (Optional) fire a toast: "Your shop has been suspended by an admin"

// shop_unsuspended
// - Update auth store: clear suspended state
// - Re-fetch shop data via /auth/check-user or equivalent
// - router.replace back to dashboard
// - (Optional) fire a toast: "Your shop is active again"
```

### Test harness

Backend has no automated e2e for push. Manual verification is the expected approach (matches existing conventions).

---

## Verification Checklist

### Backend

- [ ] When admin suspends a shop, a `shop_suspended` push notification is dispatched to all of the shop's registered Expo push tokens
- [ ] When admin unsuspends a shop, a `shop_unsuspended` push is dispatched
- [ ] Payload includes shopId, reason (suspension only), and suspendedAt timestamp
- [ ] Existing `sendShopSuspendedByAdmin` email still fires (no regression)

### Mobile (happy path)

- [ ] Shop on dashboard, admin suspends → within seconds mobile navigates to Suspended screen with correct reason
- [ ] Shop on Suspended screen, admin unsuspends → within seconds mobile navigates back to dashboard
- [ ] Shop data is refreshed (not stale) after unsuspension

### Mobile (edge cases)

- [ ] App backgrounded → admin suspends → notification shows in tray → tapping it opens the app to Suspended screen
- [ ] App killed → admin suspends → next cold-launch still routes correctly via the existing login-time branch (no regression with the prior fix)
- [ ] Push permission denied at OS level → prior "Check Status" button workaround still functions

### Cross-platform

- [ ] Works on Android (Expo notifications)
- [ ] Works on iOS (Expo notifications, APNs)
- [ ] Works whether the notification arrives while app is foreground, background, or killed

---

## Notes

- **Parent bug:** `mobile/docs/tasks/bugs/15-04-2026/bug-suspended-shop-shows-pending-screen-no-realtime.md` (Issue 1 resolved, Issue 2 deferred — this doc tracks Issue 2)
- **Related enhancement:** `mobile/docs/tasks/enhancements/websocket-realtime-messaging.md` (different scope — messaging real-time for web; not blocking this fix)
- **Fallback:** "Check Status" button on `ShopSuspendedScreen.tsx` remains as a manual escape hatch. Keep it; do not remove even after push is in place.
- **Security note:** pushing the suspension reason to the device is arguably sensitive if the reason is a private internal note. If the reason might contain internal-only content (fraud notes, investigation details), push only `shopId` and have the mobile app re-fetch shop details via `/auth/check-user` which already returns `suspensionReason`. That way the push acts as a trigger, not a data carrier. Decide with product/legal.
- **Testing in dev:** Expo push requires real device (not simulator on iOS) and a valid push token. Simulator on Android can receive FCM push; iOS simulator cannot.
