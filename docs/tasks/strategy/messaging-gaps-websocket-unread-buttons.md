# Strategy: Messaging System Gaps — WebSocket, Unread Count, Non-Functional Buttons

## Problem Statement

The messaging system is functionally complete but has three gaps:
1. **Polling-only updates** — Frontend polls every 3-10 seconds despite WebSocket infrastructure already existing on the backend
2. **Missing `getUnreadCount()` in frontend API client** — Backend endpoint exists but frontend fetches all conversations just to count unread
3. **Non-functional buttons** — Several UI buttons in the messaging interface have no click handlers

## Gap 1: No WebSocket Real-Time for Messaging

### Current State

**Backend WebSocket infrastructure (fully built):**
- `backend/src/services/WebSocketManager.ts` (492 lines)
- JWT authentication (cookie-based auto-auth + manual token auth)
- Rate limiting: 10 connections/minute per IP, 5-second auth timeout
- Heartbeat: 30-second ping/pong cycle
- Public API: `sendNotificationToUser()`, `broadcastToAll()`, `sendToAddresses()`, `isUserConnected()`
- Already used by NotificationDomain for 20+ event types (rewards, subscriptions, bookings, etc.)

**Frontend WebSocket client: DOES NOT EXIST**
- No WebSocket connection code anywhere in `frontend/src/`
- All messaging updates use `setInterval()` polling

**Current polling load per active user:**

| Component | API Call | Interval | Frequency |
|-----------|----------|----------|-----------|
| `MessagesContainer.tsx` (line 89) | `GET /messages/conversations` | 5s | 12x/min |
| `MessagesContainer.tsx` (line 163) | `GET /messages/conversations/:id/messages` | 3s | 20x/min |
| `MessageIcon.tsx` (line 46) | `GET /messages/conversations` (calculates unread) | 10s | 6x/min |
| **Total** | | | **38 requests/min** |

### Implementation Plan

#### Step 1: Create Frontend WebSocket Hook

Create `frontend/src/hooks/useWebSocket.ts`:
- Connect to backend WebSocket on mount
- Auto-authenticate via cookie (already supported by backend)
- Reconnect on disconnect with exponential backoff
- Expose `onMessage(type, callback)` for event subscriptions
- Clean up on unmount

#### Step 2: Add Messaging Events to Backend WebSocketManager

In `backend/src/domains/messaging/services/MessageService.ts`, after sending a message, broadcast via WebSocket:

```
Event: "new_message"
Payload: { conversationId, messageId, senderAddress, senderType, messageText, createdAt }
Targets: Both customer and shop addresses for that conversation
```

Similarly for:
- `conversation_created` — when new conversation is created
- `messages_read` — when messages are marked read (update read receipts)
- `typing_indicator` — replace polling with WebSocket events

#### Step 3: Update Frontend Components to Use WebSocket

**MessagesContainer.tsx:**
- Subscribe to `new_message` events → append to message list
- Subscribe to `conversation_created` → prepend to conversation list
- Subscribe to `messages_read` → update read status indicators
- **Keep polling as fallback** (increase interval to 30s) for reconnection recovery

**MessageIcon.tsx:**
- Subscribe to `new_message` → increment unread badge
- Subscribe to `messages_read` → decrement unread badge
- Remove 10-second polling entirely

**ConversationThread.tsx:**
- Subscribe to `typing_indicator` → show typing bubble in real-time
- Remove polling for typing indicators

#### Step 4: Graceful Degradation

- If WebSocket disconnects, fall back to current polling intervals
- On reconnect, fetch latest state to sync any missed events
- Log WebSocket connection status for debugging

### Impact
- **Performance**: ~38 requests/min → ~1 request/min (fallback poll only)
- **UX**: Messages appear instantly instead of 3-5 second delay
- **Server load**: Significant reduction in API calls under load

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/hooks/useWebSocket.ts` | **NEW** — WebSocket connection hook |
| `frontend/src/components/messaging/MessagesContainer.tsx` | Subscribe to WS events, reduce polling |
| `frontend/src/components/messaging/MessageIcon.tsx` | Subscribe to WS events, remove polling |
| `frontend/src/components/messaging/ConversationThread.tsx` | WS typing indicators |
| `backend/src/domains/messaging/services/MessageService.ts` | Emit WS events on send/read |
| `backend/src/domains/messaging/index.ts` | Inject WebSocketManager reference |

---

## Gap 2: Missing `getUnreadCount()` in Frontend API Client

### Current State

**Backend endpoint exists and works:**
- Route: `GET /api/messages/unread/count` (in `messaging/routes.ts` line 55)
- Controller: `MessageController.getUnreadCount` (lines 213-244)
- Returns: `{ success: true, count: number }`

**Frontend workaround (inefficient):**
- `MessageIcon.tsx` (line 23) calls `getConversations({ page: 1, limit: 100 })`
- Iterates all conversations to sum `unreadCountCustomer` or `unreadCountShop`
- Fetches 100 full conversation objects just to get a single number

### Implementation Plan

#### Step 1: Add Method to Frontend API Client

In `frontend/src/services/api/messaging.ts`, add:

```typescript
export const getUnreadCount = async (): Promise<number> => {
  const response = await apiClient.get('/messages/unread/count');
  return response.data.count;
};
```

#### Step 2: Update MessageIcon.tsx

Replace the current `fetchUnreadCount` function (lines 22-34):

```typescript
// Before: fetches all conversations, iterates to count
const conversations = await getConversations({ page: 1, limit: 100 });
const totalUnread = conversations.reduce(...)

// After: single lightweight call
const count = await getUnreadCount();
setUnreadCount(count);
```

### Impact
- **Response size**: ~50KB (100 conversations) → ~50 bytes (single count)
- **DB query**: Complex JOIN with pagination → Simple COUNT query
- **No backend changes needed**

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/services/api/messaging.ts` | Add `getUnreadCount()` method |
| `frontend/src/components/messaging/MessageIcon.tsx` | Use `getUnreadCount()` instead of `getConversations()` |

---

## Gap 3: Non-Functional Buttons in Messaging UI

### Current State — Buttons With No Click Handlers

| Component | Button | Icon | Line | Purpose |
|-----------|--------|------|------|---------|
| `ConversationThread.tsx` | Info | `Info` | 202-204 | Show conversation details |
| `ConversationThread.tsx` | More Options | `MoreVertical` | 205-207 | Context menu (archive, block, etc.) |
| `MessagesTab.tsx` (shop) | Filter | `Filter` | 156-159 | Filter conversations |
| `MessagesTab.tsx` (shop) | Export | `Download` | 160-163 | Export chat history |
| `BookingMessageTab.tsx` | Edit Quick Replies | `Edit2` | 130-132 | Edit canned responses |

**Note:** `BookingMessageTab.tsx` also uses **mock data** — it's not integrated with the real messaging system.

### Implementation Plan

#### Step 1: ConversationThread Header Buttons

**Info Button** — Show a slide-out panel with conversation metadata:
- Customer name, address, joined date
- Conversation created date
- Total messages exchanged
- Link to customer profile

**More Options Button** — Dropdown menu with:
- Archive conversation
- Block/unblock customer (backend already supports: `isBlocked`, `blockedBy` fields in conversations table)
- Mark as resolved

Implementation:
- Add `useState` for info panel visibility and dropdown open state
- Wire `onClick` handlers to toggle state
- Create `ConversationInfoPanel` sub-component
- Create `ConversationOptionsMenu` dropdown sub-component

#### Step 2: MessagesTab Action Buttons

**Filter Button** — Open filter popover with:
- Status filter (already exists in MessageInbox — reuse same logic)
- Date range filter
- Customer name search
- This may be redundant with MessageInbox's built-in filters. **Consider removing** if the inbox filters are sufficient.

**Export Button** — Export conversation history:
- Fetch all messages for selected conversation
- Generate CSV or text file download
- Include: timestamp, sender, message text

#### Step 3: BookingMessageTab Quick Replies Edit

**Edit Quick Replies Button** — Either:
- **Option A**: Open a modal to manage canned responses (add/edit/delete)
- **Option B**: Remove the button if quick replies are hardcoded intentionally
- **Note**: This component uses mock data. Either integrate with real messaging or document it as a future feature.

### Priority Order

1. **Info + More Options** (ConversationThread) — Most visible, users expect these to work
2. **Export** (MessagesTab) — Useful for shops keeping records
3. **Filter** (MessagesTab) — May be redundant with inbox filters
4. **Edit Quick Replies** (BookingMessageTab) — Lowest priority, uses mock data

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/messaging/ConversationThread.tsx` | Add onClick handlers, info panel, options menu |
| `frontend/src/components/shop/tabs/MessagesTab.tsx` | Add filter popover, export functionality |
| `frontend/src/components/shop/bookings/tabs/BookingMessageTab.tsx` | Wire edit button or remove it |

---

## Recommended Execution Order

| Phase | Gap | Effort | Impact |
|-------|-----|--------|--------|
| 1 | Gap 2: `getUnreadCount()` | ~15 min | Quick win — 2 files, no backend changes |
| 2 | Gap 3: Non-functional buttons | ~2-3 hours | UX polish — buttons users click expecting results |
| 3 | Gap 1: WebSocket real-time | ~4-6 hours | Performance — new frontend hook + backend events |

## Testing Checklist

### Gap 1: WebSocket
- [ ] WebSocket connects and authenticates on page load
- [ ] New message appears instantly without polling
- [ ] Unread badge updates in real-time
- [ ] Typing indicator shows via WebSocket
- [ ] Graceful fallback to polling on WS disconnect
- [ ] Reconnects automatically after disconnect
- [ ] No duplicate messages on reconnect

### Gap 2: Unread Count
- [ ] `getUnreadCount()` returns correct count
- [ ] MessageIcon uses lightweight endpoint
- [ ] Badge updates correctly when messages arrive
- [ ] Badge clears when conversation is read

### Gap 3: Buttons
- [ ] Info button opens conversation details panel
- [ ] More Options shows dropdown with archive/block
- [ ] Archive removes conversation from active list
- [ ] Block prevents further messages
- [ ] Export downloads conversation as file
- [ ] Filter button opens filter UI (or is removed if redundant)
