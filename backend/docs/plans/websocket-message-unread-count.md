# Plan: Replace Message Unread-Count Polling with WebSocket Push

## Context

The web frontend polls `GET /api/messages/unread-count` every 10 seconds via `setInterval` in `MessageIcon.tsx`. The backend already has full WebSocket infrastructure (`WebSocketManager`), used for notifications, subscription status, shop status, and manual booking payments — but messaging is not wired in.

When a message is sent, `MessageService.sendMessage` increments the receiver's unread count in DB but does not push anything over WebSocket, so the UI is stale until the next poll tick.

Goal: push a lightweight `message:new` signal to the receiver over WebSocket when a message is sent, and have `MessageIcon` refetch the unread count on receipt. Drop the 10-second polling entirely.

Mobile is out of scope — mobile uses `useFocusEffect` (no polling, no WS) and has a separate tracked task (`mobile/docs/tasks/enhancements/websocket-realtime-messaging.md`).

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/domains/messaging/index.ts` | Add `setWebSocketManager()` method, hold `wsManager` reference, forward to `MessageService` |
| `backend/src/domains/messaging/services/MessageService.ts` | Accept `wsManager` via setter; emit `message:new` WS event after `incrementUnreadCount` |
| `backend/src/app.ts` | Attach `wsManager` to `messagingDomain` (mirror existing `notificationDomain` attachment) |
| `frontend/src/hooks/useNotifications.ts` | Add `message:new` case in WS message handler, dispatch `new-message-received` DOM event |
| `frontend/src/components/messaging/MessageIcon.tsx` | Remove `setInterval(fetchUnreadCount, 10000)`, add `new-message-received` window listener |

No new files. No new env vars. No DB changes.

---

## Implementation Steps

### Step 1: Backend — `MessagingDomain.setWebSocketManager`

`backend/src/domains/messaging/index.ts`

Mirror the pattern in `NotificationDomain.setWebSocketManager` (see `backend/src/domains/notification/NotificationDomain.ts:37-40`).

```ts
import { WebSocketManager } from '../../services/WebSocketManager';

export class MessagingDomain implements DomainModule {
  // ...
  private wsManager?: WebSocketManager;

  public setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
    this.messageService.setWebSocketManager(wsManager);
    logger.info('WebSocket manager attached to MessagingDomain');
  }
}
```

### Step 2: Backend — `MessageService.sendMessage` emits `message:new`

`backend/src/domains/messaging/services/MessageService.ts`

Add a setter and an emit call after the existing `incrementUnreadCount` block (around line 138):

```ts
import { WebSocketManager } from '../../../services/WebSocketManager';

export class MessageService {
  private wsManager?: WebSocketManager;

  public setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  async sendMessage(request: SendMessageRequest): Promise<Message> {
    // ... existing code through incrementUnreadCount ...

    // Emit WebSocket signal so the receiver's MessageIcon refreshes its badge
    try {
      const receiverAddress = request.senderType === 'customer'
        ? conversation.shopId
        : conversation.customerAddress;

      this.wsManager?.sendToAddresses([receiverAddress], {
        type: 'message:new',
        payload: { conversationId: conversation.conversationId }
      });
    } catch (wsError) {
      logger.error('Failed to send message:new WS event:', wsError);
      // Non-fatal — the message was already saved and DB unread count incremented
    }

    // ... rest of existing code (email notification, etc.) ...
  }
}
```

The payload intentionally carries only `conversationId`. The frontend refetches the authoritative unread total via the existing REST endpoint — same pattern `useNotifications` already uses for `shop_status_changed` and `subscription_status_changed`.

### Step 3: Backend — Attach `wsManager` in `app.ts`

`backend/src/app.ts`, immediately after the existing `notificationDomain.setWebSocketManager` block (lines 672-675):

```ts
const messagingDomain = this.domainRegistry.getDomain('messages') as any;
if (messagingDomain?.setWebSocketManager) {
  messagingDomain.setWebSocketManager(this.wsManager);
  logger.info('✅ WebSocket manager attached to MessagingDomain');
}
```

### Step 4: Frontend — `useNotifications` handles `message:new`

`frontend/src/hooks/useNotifications.ts`, add a new case in the `ws.onmessage` switch (next to the existing `manual_booking_payment_completed` case around line 252):

```ts
case 'message:new':
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('new-message-received', {
      detail: message.payload
    }));
  }
  break;
```

### Step 5: Frontend — `MessageIcon` replaces polling with listener

`frontend/src/components/messaging/MessageIcon.tsx`

- Remove `const pollInterval = setInterval(fetchUnreadCount, 10000);` and its `clearInterval` cleanup.
- Keep the initial `fetchUnreadCount()` call (runs on mount, covers reconnect-after-disconnect because `useNotifications` disconnects and clears state on logout/switch).
- Add a `new-message-received` window listener that calls `fetchUnreadCount()`.

```tsx
useEffect(() => {
  if (!userType || (userType !== 'customer' && userType !== 'shop') || switchingAccount) {
    return;
  }

  const fetchUnreadCount = async () => {
    try {
      const count = await messagingApi.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('[MessageIcon] Error fetching unread message count:', err);
    }
  };

  fetchUnreadCount();

  const handleNewMessage = () => fetchUnreadCount();
  window.addEventListener('new-message-received', handleNewMessage);

  return () => window.removeEventListener('new-message-received', handleNewMessage);
}, [userType, switchingAccount]);
```

---

## Event Contract

**Type:** `message:new`

**Payload:**
```ts
{ conversationId: string }
```

**Sent to:** `[receiverAddress]` (shop address if sender is customer, customer address if sender is shop).

**Frontend behavior:** dispatches `new-message-received` window event. `MessageIcon` refetches `GET /api/messages/unread-count`. Other components (conversation list, active chat) can subscribe to the same window event later if we want incremental updates without more WS wiring.

---

## Out of Scope

- Real-time new-message rendering inside an open conversation view (still uses existing mechanism).
- Typing indicators over WebSocket.
- Read-receipt propagation over WebSocket (reads are user-initiated; local state already reflects them).
- Mobile integration — tracked separately in `mobile/docs/tasks/enhancements/websocket-realtime-messaging.md`.

---

## Testing

Manual:
1. Log in as Customer A in one browser and Shop B in another.
2. From Shop B, send a message to Customer A.
3. Customer A's `MessageIcon` badge should update within ~1 second (WS round-trip + refetch) — no 10-second wait.
4. Kill the backend WS connection (e.g., restart backend). Confirm the frontend reconnects via the existing exponential-backoff path in `useNotifications` and badge updates resume on next message.
5. Log out Customer A. Confirm no `new-message-received` listener remains attached (no badge updates on subsequent messages).

Regression checks:
- Existing `subscription_status_changed`, `shop_status_changed`, and `manual_booking_payment_completed` flows still work.
- Message send flow still creates DB row, increments unread count, sends shop email when customer messages.
