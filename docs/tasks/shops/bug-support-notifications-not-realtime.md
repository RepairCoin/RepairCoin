# Bug: Support Notifications Don't Arrive Instantly — Shop Must Refresh

## Status: Open
## Priority: Medium
## Date: 2026-04-22
## Category: Enhancement / Real-time Notifications
## Platform: Web (frontend dashboard)
## Affects: Shop dashboard notification bell for support ticket replies

---

## Problem

When an admin replies to a support ticket via the admin support management chat, the shop's notification bell on `https://repaircoin.ai` (and staging) does **not** update in real-time. The shop must manually refresh the page (or navigate) before the new notification appears in the bell.

Expected behavior: the notification should arrive **instantly** — bell badge increments, new notification appears at the top of the list, optional toast — all without any refresh action from the shop.

---

## Context — related task

This is a **follow-up** to `docs/tasks/shops/bug-support-notifications-wrong-receiver-address.md` (fixed in commit `9dbddac0`). That fix made support notifications **visible** in the bell at all (the shopId-receiver mismatch meant they were previously invisible). This task adds the **real-time delivery** dimension — notifications should appear without refresh, not just after refresh.

Explicitly out of scope there, explicitly in scope here.

---

## Root Cause / Current State

### The WebSocket infrastructure exists and works for other notification types

- `backend/src/services/WebSocketManager.ts` — connection manager
- `backend/src/domains/notification/NotificationDomain.ts` — at lines 99, 125, 152, 176, 199, 222 has calls like:
  ```typescript
  if (this.wsManager) {
    this.wsManager.sendNotificationToUser(address, notification);
  }
  ```
  These fire after notification creation to push in real-time to connected WebSocket clients.
- `frontend/src/hooks/useNotifications.ts:182` — already listens for incoming `new_notification` WebSocket messages and auto-updates the bell without refresh.

### But support notifications don't flow through that path

`backend/src/services/SupportChatService.ts` calls `NotificationService.createNotification(...)` directly (lines 288, 304, 327):

```typescript
await this.notificationService.createNotification({
  senderAddress: message.senderId,
  receiverAddress: ticket.shopId,   // ← shopId like "peanut", NOT a wallet
  notificationType: 'support_message_received',
  ...
});
```

`NotificationService.createNotification` (file `backend/src/domains/notification/services/NotificationService.ts:179-215`) only writes to the DB — **it does NOT emit a WebSocket event.** No `wsManager.sendNotificationToUser(...)` call. So support notifications never hit the real-time path even though the infrastructure is ready.

### Second obstacle — receiver is shopId, not wallet

Even if we added a WebSocket emit to `NotificationService.createNotification`, it would call `wsManager.sendNotificationToUser("peanut", ...)`. But WebSocket connections are keyed by the user's **wallet address** (from the JWT when the socket connects), not by shopId. So the emit would fail silently — no connected client is registered under the key `"peanut"`.

The fix must:
1. Emit a WebSocket event when support notifications are created
2. Route the emit by the shop's **wallet address** (resolved from `ticket.shopId`), not by the shopId itself

---

## Fix Required

### Recommended approach — emit at the SupportChatService boundary

Minimal surface area, explicit for the support flow. Two edits:

**Edit 1:** `backend/src/services/SupportChatService.ts` — after `notifyShopOfNewMessage` creates the notification, also emit via WebSocket to the shop's wallet address.

```typescript
private async notifyShopOfNewMessage(ticket: SupportTicket, message: SupportMessage): Promise<void> {
  const notification = await this.notificationService.createNotification({
    senderAddress: message.senderId,
    receiverAddress: ticket.shopId,
    notificationType: 'support_message_received',
    message: `Admin responded to your ticket: ${ticket.subject}`,
    metadata: { ticketId: ticket.id, messageId: message.id, subject: ticket.subject }
  });

  // NEW: real-time push to the shop's connected WebSocket, if any
  const shopWalletAddress = await this.resolveShopWalletAddress(ticket.shopId);
  if (shopWalletAddress && this.wsManager) {
    this.wsManager.sendNotificationToUser(shopWalletAddress, notification);
  }
}
```

Note: `resolveShopWalletAddress` already exists in `SupportChatService.ts:285` — reuse it.

**Edit 2:** `SupportChatService` constructor — inject the `WebSocketManager` instance (currently only `NotificationService` is injected). Pattern already used by `NotificationDomain`.

Also apply the same pattern to `notifyAdminsOfNewMessage` and `notifyShopOfStatusChange` if you want admins to see shop replies in real-time too (likely yes — symmetric UX).

### Alternative approach — emit from NotificationService (not recommended)

Modify `NotificationService.createNotification` to always emit via WebSocket. Problem: the `receiverAddress` passed in is sometimes a wallet (resolved) and sometimes a shopId. Adding resolution logic there makes the service more complex and creates a hidden side-effect on every notification. Better to keep it explicit at the call site.

---

## Frontend changes

**Likely none.** `frontend/src/hooks/useNotifications.ts:182` already handles incoming `new_notification` WebSocket messages and calls `refetch()` or equivalent to update the bell. As long as the backend emits the notification using the shop's connected socket key (wallet address), the existing frontend handler picks it up.

**Verify during implementation:** read `useNotifications.ts` and confirm the handler for `new_notification` payloads also covers support notification types (it should — these are all treated as generic "new notification" arrivals).

If the frontend also needs type-specific handling (e.g., toast for support messages), that's a small addition to the existing switch-case in `useNotifications.ts`.

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/services/SupportChatService.ts` | Accept `WebSocketManager` in constructor; in `notifyShopOfNewMessage`, call `wsManager.sendNotificationToUser(shopWalletAddress, notification)` after creating the DB record. Apply same pattern to `notifyAdminsOfNewMessage` and `notifyShopOfStatusChange`. |
| Wherever `SupportChatService` is instantiated (search for `new SupportChatService(`) | Pass the `WebSocketManager` singleton, same as `NotificationDomain` does. |
| `frontend/src/hooks/useNotifications.ts` (verify only — likely no change) | Confirm existing `new_notification` handler picks up support types. Add toast if desired. |

---

## Verification

### Real-time delivery
- [ ] Shop logged into dashboard with bell visible, admin replies to ticket → within ~1-2 seconds, bell badge increments and new notification appears in list, no refresh required
- [ ] Shop on a different page of the dashboard → bell badge still updates
- [ ] Shop logged in via MetaMask → real-time works
- [ ] Shop logged in via social login (embedded wallet) → real-time works
- [ ] Admin also sees real-time update when shop replies back (symmetric behavior)

### Fallback behavior
- [ ] Shop closes browser, admin replies → shop opens browser 5 min later → notification visible on page load (existing visibility fix from commit `9dbddac0`)
- [ ] Shop's WebSocket disconnects mid-session (e.g., network blip) → on reconnect, any missed notifications appear (via refresh, not via WebSocket replay — documented fallback)

### No regressions
- [ ] Non-support notifications (rewards, bookings, subscriptions) still work normally
- [ ] Customer bell still works
- [ ] Admin bell still works
- [ ] Backend typecheck + tests pass

---

## Mobile Scope — Deferred

Mobile (React Native / Expo) has **no WebSocket client** at all. See inventory earlier today at `docs/tasks/strategy/phase-0-inventory.md` and related note in `mobile/docs/tasks/enhancements/websocket-realtime-messaging.md`.

Real-time support notifications on mobile require:
- Either building a full mobile WebSocket client (~4-6 hr per the enhancement doc)
- Or leveraging Expo push notifications (simpler for one-shot events; see `mobile/docs/tasks/bugs/22-04-2026/bug-mobile-no-realtime-suspension-detection.md` for the Option A push pattern we proposed for shop suspension)

**This task doc covers web only.** Mobile real-time support messages is its own follow-up.

---

## Notes

- **Not blocking cutover** — this is UX polish. The visibility fix (commit `9dbddac0`) already solves the "shop never sees the notification" problem. This task upgrades the experience from "see on refresh" to "see instantly."
- **Connection lifecycle:** WebSocket connections are established when the user loads a dashboard page and torn down on page unload/logout. Users with multiple tabs may have multiple connections — the WebSocket emit should target all of them (existing `sendNotificationToUser` likely handles this, verify).
- **Auth-wallet vs shop-wallet nuance:** the parent task doc noted shops have multiple identities (shopId, shop wallet, owner wallet, social wallet). The JWT carries whichever wallet the shop logged in with. The WebSocket is keyed by that wallet. `resolveShopWalletAddress(shopId)` returns the SHOP's wallet (from the DB record), which may differ from the user's logged-in wallet if the shop is owned by a social-login user whose embedded wallet is different from the shop's on-chain wallet. **Implementation should emit to the SHOP's wallet AND the owner's logged-in wallet if they differ** — or resolve via the same multi-address principle as the bell query. TBD at implementation time; may need a secondary helper to find "all possible connected wallets for this shopId."
- **Estimated effort:** 2-3 hours backend, ~30 min frontend verification/polish, 1 hr QA.
