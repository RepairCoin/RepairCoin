# Bug: Support Notifications Use Wrong Receiver Address

## Status: Completed
## Resolved: 2026-04-22
## Resolution: Fixed in commit `9dbddac0 fix: support ticket notifications use wrong receiver_address`. Option A from the fix menu was applied — notification controller now queries by both `req.user.address` (wallet) AND `req.user.shopId`, so notifications stored with `receiver_address = shopId` become visible without data migration. Fix extends across all notification CRUD endpoints (get, get-by-id, unread, unread-count, mark-as-read, mark-all-read, delete, delete-all). Verification 2026-04-22 via `backend/scripts/verify-support-notifications-fix.ts` confirmed 278 notifications for shop "peanut" (126 under shopId, 152 under wallet) all surfaced correctly by multi-address query; no case-sensitivity gaps. QA guide at `docs/tasks/test/qa-support-notifications-multi-address-fix.md` for manual browser verification.
## Follow-up: Real-time delivery (instant WebSocket push without page refresh) was NOT in scope for this fix — tracked separately at `docs/tasks/shops/bug-support-notifications-not-realtime.md`.
## Priority: High
## Date: 2026-03-24
## Category: Bug - Notifications
## Found by: Manual testing (shop never sees admin support responses)

---

## Problem

When admin replies to a support ticket, the shop owner never receives a notification in their notification bell. The notification is created in the database but with the wrong `receiver_address`.

---

## Root Cause

The notification system has an **identity mismatch** between how notifications are created and how they're queried:

**Creating (SupportChatService.ts line 310):**
```typescript
receiverAddress: ticket.shopId  // "peanut"
```

**Querying (NotificationController.ts line 18-28):**
```typescript
const walletAddress = req.user?.address;  // "0x960aa..."
// queries: WHERE receiver_address = "0x960aa..."
```

The notification is stored with `receiver_address = "peanut"` but the bell queries by `receiver_address = "0x960aa..."`. They never match.

---

## The Identity Problem

A shop has **multiple possible identities**:

| Identity | Example | Used By |
|----------|---------|---------|
| Shop ID | `peanut` | Support notifications, some booking notifications |
| Shop wallet | `0xb3afc20c...` | Shop registration, blockchain |
| Owner wallet | `0x960aa...` | JWT login (MetaMask) |
| Social login wallet | `0xEmbedded...` | JWT login (social/email) |

The notification bell always queries by the **logged-in user's wallet address** (from JWT `req.user.address`). But the logged-in address changes depending on login method:
- **MetaMask login**: uses the MetaMask wallet address
- **Social login**: uses the Thirdweb embedded wallet address (different from MetaMask)

Both might be the same shop owner but with different addresses.

---

## Current Data Evidence

```
Notifications with receiver="peanut":     88  (never seen by bell)
Notifications with receiver="0xb3afc...": 115 (shop wallet - seen if logged in with this wallet)
Notifications with receiver="0x960aa...": 119 (owner wallet - seen if logged in with MetaMask)
```

---

## Fix Options

### Option A: Query by BOTH wallet address AND shopId (Recommended)

Change the notification query to fetch notifications for both the user's wallet AND their shopId:

```typescript
// NotificationController.ts
const walletAddress = req.user?.address;
const shopId = req.user?.shopId; // Available for shop role

const result = await this.service.getNotificationsByReceiverMulti(
  [walletAddress, shopId].filter(Boolean),
  { page, limit }
);
```

```sql
-- Repository query
SELECT * FROM notifications
WHERE receiver_address = ANY($1)
ORDER BY created_at DESC
```

**Pros:** Works regardless of which address is used. No migration needed.
**Cons:** Slightly more complex query. Must ensure shopId is available in JWT.

### Option B: Always use shopId for shop notifications

Standardize ALL shop notifications to use `shopId` as receiver, and change the bell query to use `shopId` when the user is a shop.

```typescript
// NotificationController.ts
const receiverKey = req.user?.role === 'shop' ? req.user.shopId : req.user?.address;
```

**Pros:** Simple, consistent.
**Cons:** Breaks existing notifications that used wallet address. Requires migration of existing data.

### Option C: Always resolve to wallet address

Change `SupportChatService` to look up the shop's wallet address before creating notifications:

```typescript
const shop = await shopRepository.getShop(ticket.shopId);
receiverAddress: shop.walletAddress  // "0xb3afc20c..."
```

**Pros:** Consistent with other notification patterns.
**Cons:** Doesn't solve the MetaMask vs social login problem. The shop wallet `0xb3afc...` might not match the owner's login wallet `0x960aa...`.

---

## Recommendation

**Option A** is the best fix because:
- It handles ALL identity types (shopId, shop wallet, owner wallet, social wallet)
- No migration needed for existing data
- Works retroactively for notifications already stored with shopId
- The JWT already contains `shopId` for shop users

---

## Scope of Impact

This affects ALL shop notifications that use `shopId` as receiver:
- Support ticket responses (admin → shop)
- Support ticket status changes
- Some booking notifications
- Appointment reminders

88 notifications for "peanut" are currently invisible to the shop owner.

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/domains/notification/controllers/NotificationController.ts` | Query by both wallet and shopId |
| `backend/src/domains/notification/services/NotificationService.ts` | Add `getNotificationsByReceiverMulti` method |
| `backend/src/repositories/NotificationRepository.ts` | Add `findByReceiverMulti` with `ANY($1)` query |

---

## Verification

- [ ] Admin replies to support ticket → shop sees notification in bell
- [ ] Shop logged in via MetaMask → sees all notifications (support + bookings)
- [ ] Shop logged in via social → sees all notifications (support + bookings)
- [ ] Existing "peanut" receiver notifications become visible
- [ ] Customer notifications unaffected
- [ ] Admin notifications unaffected
