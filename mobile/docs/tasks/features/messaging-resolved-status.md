# Feature: Messaging Resolved Status + Badge

**Status:** Open
**Priority:** HIGH
**Est. Effort:** 2-3 hours
**Created:** 2026-03-13

---

## Problem

Shops need to differentiate between:
- **Open conversations** - work to do
- **Resolved conversations** - done

Currently there's no "resolved" status, only archive.

## Current State

- Conversation interface has: `isArchivedCustomer`, `isArchivedShop`, `isBlocked`
- No `status` or `resolved` field exists
- No visual indicator for resolved conversations

## Implementation

### Backend Changes

#### 1. Database Migration

```sql
ALTER TABLE conversations
ADD COLUMN status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'resolved'));
```

#### 2. Update MessageRepository

Add to Conversation interface:
```typescript
export interface Conversation {
  // ... existing fields
  status: 'open' | 'resolved';
}
```

Add method:
```typescript
async markConversationResolved(conversationId: string): Promise<void> {
  const query = `
    UPDATE conversations
    SET status = 'resolved', updated_at = NOW()
    WHERE conversation_id = $1
  `;
  await this.pool.query(query, [conversationId]);
}

async markConversationOpen(conversationId: string): Promise<void> {
  const query = `
    UPDATE conversations
    SET status = 'open', updated_at = NOW()
    WHERE conversation_id = $1
  `;
  await this.pool.query(query, [conversationId]);
}
```

#### 3. Add Controller Endpoints

```
POST /api/messages/conversations/:conversationId/resolve
POST /api/messages/conversations/:conversationId/reopen
```

### Mobile Changes

#### 1. Update Conversation Interface

```typescript
// shared/interfaces/message.interface.ts
export interface Conversation {
  // ... existing fields
  status: 'open' | 'resolved';
}
```

#### 2. Add API Methods

```typescript
// message.services.ts
async resolveConversation(conversationId: string): Promise<{ message: string }> {
  return await apiClient.post(`/messages/conversations/${conversationId}/resolve`);
}

async reopenConversation(conversationId: string): Promise<{ message: string }> {
  return await apiClient.post(`/messages/conversations/${conversationId}/reopen`);
}
```

#### 3. Add Resolved Badge to ConversationItem

```tsx
{conversation.status === 'resolved' && (
  <View className="bg-green-500/20 px-2 py-0.5 rounded">
    <Text className="text-green-500 text-xs font-medium">Resolved</Text>
  </View>
)}
```

#### 4. Add to ChatHeader

Show resolved badge next to name when `status === 'resolved'`

#### 5. Add to ConversationMoreMenu

- "Mark Resolved" option (when open)
- "Reopen" option (when resolved)

## Files to Modify

**Backend:**
- `backend/src/repositories/MessageRepository.ts`
- `backend/src/domains/messaging/services/MessageService.ts`
- `backend/src/domains/messaging/controllers/MessageController.ts`
- `backend/src/domains/messaging/routes.ts`
- New migration file

**Mobile:**
- `mobile/shared/interfaces/message.interface.ts`
- `mobile/feature/messages/services/message.services.ts`
- `mobile/feature/messages/components/ConversationItem.tsx`
- `mobile/feature/messages/components/ChatHeader.tsx`
- `mobile/feature/messages/components/ConversationMoreMenu.tsx`
- `mobile/feature/messages/screens/ChatScreen.tsx`

## Verification Checklist

- [ ] Database migration adds status column
- [ ] Resolved badge shows in conversation list
- [ ] Resolved badge shows in chat header
- [ ] "Mark Resolved" option in more menu
- [ ] "Reopen" option shows when resolved
- [ ] Status persists after app restart
- [ ] Works for both customer and shop views
