# BUG-010: Support ticket notifications use wrong receiver_address

**Type:** Logic Bug
**Severity:** Critical
**Priority:** P0
**Component:** Backend - Notification System / Support Chat
**Labels:** bug, backend, notifications, support
**Status:** OPEN
**Date Found:** 2026-03-24

---

## Description

When admin replies to a support ticket, the shop owner never receives a notification in their notification bell. The notification is created in the database but with the wrong `receiver_address` — it uses `ticket.shopId` (e.g., `"peanut"`) instead of the shop's wallet address (e.g., `"0x960aa..."`).

---

## Symptoms

- Admin replies to a support ticket
- Shop owner's notification bell shows nothing
- Database has 88+ notifications with `receiver_address = "peanut"` that are invisible
- Notification is created successfully (no errors in logs)

---

## Root Cause

**Identity mismatch** between how notifications are written and read:

**Writing (SupportChatService.ts):**
```typescript
// Line 310 - notifyShopOfNewMessage()
receiverAddress: ticket.shopId  // "peanut" (shop slug/ID)

// Line 337 - notifyShopOfStatusChange()
receiverAddress: ticket.shopId  // "peanut"
```

**Reading (NotificationController.ts):**
```typescript
// Line 18 - getNotifications()
const walletAddress = req.user?.address;  // "0x960aa..."
// queries: WHERE receiver_address = "0x960aa..."
```

The notification is stored with `receiver_address = "peanut"` but the bell queries `WHERE receiver_address = "0x960aa..."`. They never match.

### Additional Complexity: Multiple Shop Identities

A shop has multiple possible identities:

| Identity | Example | Used By |
|----------|---------|---------|
| Shop ID | `peanut` | Support notifications (current bug) |
| Shop wallet | `0xb3afc20c...` | Shop registration, blockchain |
| Owner wallet | `0x960aa...` | JWT login (MetaMask) |
| Social login wallet | `0xEmbedded...` | JWT login (social/email) |

All 5 `senderAddress`/`receiverAddress` usages in SupportChatService are affected:

| Line | Method | Field | Value |
|------|--------|-------|-------|
| 245 | `notifyAdminsOfNewTicket` | `senderAddress` | `ticket.shopId` |
| 269 | `notifyAdminsOfNewMessage` (assigned) | `senderAddress` | `ticket.shopId` |
| 287 | `notifyAdminsOfNewMessage` (all) | `senderAddress` | `ticket.shopId` |
| 310 | `notifyShopOfNewMessage` | `receiverAddress` | `ticket.shopId` |
| 337 | `notifyShopOfStatusChange` | `receiverAddress` | `ticket.shopId` |

---

## Solution: Query by multiple addresses (Option A)

Fix the **read side** so the notification controller queries by both `walletAddress` AND `shopId`. This retroactively fixes all 88 existing broken notifications.

### Files to Modify

| File | Change |
|------|--------|
| `backend/src/repositories/NotificationRepository.ts` | Add multi-address query methods using `WHERE receiver_address = ANY($1)` |
| `backend/src/domains/notification/services/NotificationService.ts` | Add multi-address wrapper methods |
| `backend/src/domains/notification/controllers/NotificationController.ts` | Build `[walletAddress, shopId]` array, call multi-address methods |
| `backend/src/services/SupportChatService.ts` | Fix `senderAddress` to use shop wallet (cosmetic consistency) |

### Step 1: NotificationRepository — Add multi-address methods

Add alongside existing single-address methods:

```typescript
async findByReceiverMulti(addresses: string[], pagination: PaginationParams): Promise<PaginatedResult<Notification>> {
  const lowerAddresses = addresses.map(a => a.toLowerCase());
  // COUNT query: WHERE receiver_address = ANY($1)
  // SELECT query: WHERE receiver_address = ANY($1) ORDER BY created_at DESC LIMIT $2 OFFSET $3
}

async findUnreadByReceiverMulti(addresses: string[]): Promise<Notification[]> {
  // WHERE receiver_address = ANY($1) AND is_read = false
}

async getUnreadCountMulti(addresses: string[]): Promise<number> {
  // WHERE receiver_address = ANY($1) AND is_read = false
}

async markAllAsReadMulti(addresses: string[]): Promise<number> {
  // WHERE receiver_address = ANY($1) AND is_read = false
}

async deleteAllForReceiverMulti(addresses: string[]): Promise<number> {
  // WHERE receiver_address = ANY($1)
}
```

### Step 2: NotificationService — Add wrapper methods

Thin wrappers calling the new repository methods.

### Step 3: NotificationController — Use address array

In each endpoint, build the address array:

```typescript
const addresses = [req.user?.address, req.user?.shopId].filter(Boolean) as string[];
```

Update these methods:
- `getNotifications` (line 16)
- `getUnreadNotifications` (line 44)
- `getUnreadCount` (line 66)
- `markAllAsRead` (line 158)
- `deleteAllNotifications` (line 216)
- `getNotificationById` (line 88) — ownership check against all addresses
- `markAsRead` (line 122) — ownership check against all addresses
- `deleteNotification` (line 180) — ownership check against all addresses

### Step 4: SupportChatService — Fix senderAddress (cosmetic)

Import `ShopRepository`, resolve wallet address for `senderAddress` in notification methods:

```typescript
const shop = await this.shopRepository.getShop(ticket.shopId);
const shopAddress = shop?.walletAddress || ticket.shopId;
```

---

## Testing

### Manual Test
1. Admin replies to support ticket -> shop sees notification in bell
2. Shop logged in via MetaMask -> sees all notifications
3. Shop logged in via social -> sees all notifications
4. Existing `receiver_address = "peanut"` notifications become visible
5. Customer/admin notifications unaffected

### Automated
```bash
cd backend && npm run typecheck
cd backend && npm run test
```

---

## Related Files

| File | Role |
|------|------|
| `backend/src/services/SupportChatService.ts` | Creates notifications with wrong address |
| `backend/src/repositories/NotificationRepository.ts` | Queries by single address |
| `backend/src/domains/notification/services/NotificationService.ts` | Service layer |
| `backend/src/domains/notification/controllers/NotificationController.ts` | Reads by `req.user.address` only |
| `docs/tasks/services/bug-support-notifications-wrong-receiver-address.md` | Original investigation doc |

---

## Impact

| Area | Before | After |
|------|--------|-------|
| **Shop notifications** | 88+ invisible notifications | All visible |
| **Admin replies** | Shop never notified | Shop sees bell notification |
| **Status changes** | Shop never notified | Shop sees bell notification |
| **Login method** | Only one wallet's notifications visible | All identities unified |

---

## Prevention

1. Always use wallet addresses (not entity IDs) when creating notifications
2. Consider normalizing shop identity to a single canonical address
3. Add integration test: create notification -> verify it appears in bell query
