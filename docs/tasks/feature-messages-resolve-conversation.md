# FEATURE: Resolve / Reopen Conversations

**Status:** Complete
**Priority:** Medium
**Type:** Feature (Messaging Enhancement)
**Created:** 2026-03-11

## Description

The **Active** and **Resolved** filter tabs in `MessageInbox.tsx` were functional (filtering by `conv.status`), but no conversation could ever reach "resolved" status because:

1. No backend endpoint existed to archive/resolve a conversation
2. No frontend API method for archiving existed
3. No UI action (button/menu) was available to resolve a conversation

The conversation `status` is derived from `is_archived_customer` / `is_archived_shop` columns in the database, but nothing ever set them to `true`.

## Implementation

### Backend

**File:** `backend/src/repositories/MessageRepository.ts`
- Added `setConversationArchived(conversationId, userType, archived)` method
- Updates `is_archived_customer` or `is_archived_shop` column based on user type

**File:** `backend/src/domains/messaging/services/MessageService.ts`
- Added `setConversationArchived()` with ownership validation (verifies user is part of conversation)

**File:** `backend/src/domains/messaging/controllers/MessageController.ts`
- Added `archiveConversation` controller method
- Accepts `{ archived: boolean }` in request body

**File:** `backend/src/domains/messaging/routes.ts`
- Added route: `PATCH /api/messages/conversations/:conversationId/archive`

### Frontend API

**File:** `frontend/src/services/api/messaging.ts`
- Added `archiveConversation(conversationId, archived)` method

### Frontend UI

**File:** `frontend/src/components/messaging/MessagesContainer.tsx`
- Added `handleArchiveConversation` handler that calls API and updates local conversation state
- Passes `conversationStatus` and `onArchiveConversation` props to `ConversationThread`

**File:** `frontend/src/components/messaging/ConversationThread.tsx`
- The `⋮` (MoreVertical) button now opens a dropdown menu with:
  - **"Resolve Conversation"** — when conversation is active (sets `archived = true`)
  - **"Reopen Conversation"** — when conversation is resolved (sets `archived = false`)
- Green "Resolved" badge displayed in header when status is resolved
- Click-outside dismissal for the dropdown menu

## Files Modified

| File | Action |
| ---- | ------ |
| `backend/src/repositories/MessageRepository.ts` | Added `setConversationArchived` method |
| `backend/src/domains/messaging/services/MessageService.ts` | Added `setConversationArchived` with auth check |
| `backend/src/domains/messaging/controllers/MessageController.ts` | Added `archiveConversation` controller |
| `backend/src/domains/messaging/routes.ts` | Added PATCH archive route |
| `frontend/src/services/api/messaging.ts` | Added `archiveConversation` API method |
| `frontend/src/components/messaging/MessagesContainer.tsx` | Added handler, pass props to thread |
| `frontend/src/components/messaging/ConversationThread.tsx` | Added ⋮ dropdown with resolve/reopen actions |

## API Endpoint

```
PATCH /api/messages/conversations/:conversationId/archive
Authorization: Bearer <token>
Body: { "archived": true }   // true = resolve, false = reopen
Response: { "success": true, "message": "Conversation resolved" }
```

## How It Works

1. User clicks ⋮ in conversation header → sees "Resolve Conversation"
2. Clicking it calls `PATCH /archive` with `{ archived: true }`
3. Backend sets `is_archived_shop = true` (or `is_archived_customer` for customers)
4. Frontend updates local state → conversation status becomes "resolved"
5. MessageInbox "Resolved" tab now shows the conversation
6. User can reopen via ⋮ → "Reopen Conversation"

## Effort

~30 minutes
