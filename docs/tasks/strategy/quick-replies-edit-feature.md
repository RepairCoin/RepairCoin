# Task: Quick Replies — Edit Button & CRUD Management

## Problem Statement

The Quick Replies section in the booking detail panel Message tab currently shows 3 hardcoded mock replies from `mockData.ts`. The Edit button (pencil icon) has no `onClick` handler. Shops cannot create, edit, or delete their own quick replies.

## Current State

- **Quick Replies UI exists** — 3 hardcoded replies in `BookingDetailsPanel.tsx` (imported from `mockData.ts > quickReplies`)
- **Edit button exists** — pencil icon rendered but no functionality
- **Clicking a quick reply sends it** — already wired to real messaging via `handleSendMessage`
- **No backend support** — no database table, no API endpoints, no repository

## Goal

Make the Edit button functional so shops can manage their own library of quick reply templates (create, edit, delete). Replace hardcoded mock replies with real data from the API.

## Implementation Plan

### Step 1: Database — Create `shop_quick_replies` Table

```sql
CREATE TABLE shop_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quick_replies_shop ON shop_quick_replies(shop_id, is_active);
```

### Step 2: Backend — Repository + Controller + Routes

**Repository** — `QuickReplyRepository.ts`:
- `getByShopId(shopId)` — list all active replies sorted by usage_count desc
- `create(shopId, title, content, category)` — add new reply
- `update(id, shopId, { title, content, category })` — edit existing
- `delete(id, shopId)` — soft delete (set is_active = false)
- `incrementUsage(id)` — bump usage_count when a reply is sent

**Routes** — Add to messaging domain routes:
```
GET    /api/messages/quick-replies           — List shop's quick replies
POST   /api/messages/quick-replies           — Create new reply
PUT    /api/messages/quick-replies/:id       — Update reply
DELETE /api/messages/quick-replies/:id       — Delete reply
```

**Controller** — Add methods to `MessageController.ts` or create `QuickReplyController.ts`

### Step 3: Frontend — API Client

Add to `frontend/src/services/api/messaging.ts`:
```typescript
// Quick Replies
getQuickReplies(): Promise<QuickReply[]>
createQuickReply(data: { title: string; content: string; category?: string }): Promise<QuickReply>
updateQuickReply(id: string, data: { title?: string; content?: string; category?: string }): Promise<QuickReply>
deleteQuickReply(id: string): Promise<void>
```

### Step 4: Frontend — Quick Reply Manager Modal

New component `QuickReplyManager.tsx`:
- Opens when Edit button (pencil icon) is clicked
- Lists all quick replies with inline edit/delete
- "Add New" form with content field (title optional)
- Category selector (general, booking, payment, greeting)
- Saves via API on submit

### Step 5: Frontend — Wire Up BookingDetailsPanel

In `BookingDetailsPanel.tsx`:
- Replace hardcoded `quickReplies` import from `mockData.ts` with API data
- Fetch quick replies on component mount via `messagingApi.getQuickReplies()`
- Edit button onClick opens `QuickReplyManager` modal
- On quick reply click, call `incrementUsage(id)` after sending message
- Fallback to 3 default replies if shop has none configured

## Files to Create

| File | Description |
|------|-------------|
| `backend/migrations/XXX_create_quick_replies.sql` | Create table |
| `backend/src/repositories/QuickReplyRepository.ts` | CRUD operations |
| `frontend/src/components/messaging/QuickReplyManager.tsx` | Edit modal |

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/domains/messaging/controllers/MessageController.ts` | Add quick reply endpoints |
| `backend/src/domains/messaging/routes.ts` | Add quick reply routes |
| `frontend/src/services/api/messaging.ts` | Add quick reply API methods |
| `frontend/src/components/shop/bookings/BookingDetailsPanel.tsx` | Wire Edit button, fetch real data, replace mock imports |

## Files to Keep

| File | Reason |
|------|--------|
| `frontend/src/components/shop/bookings/tabs/BookingMessageTab.tsx` | Reference for original UI layout |
| `frontend/src/components/shop/bookings/mockData.ts` | Keep `quickReplies` as default fallback |

## Default Quick Replies (Seed Data)

When a shop has no custom replies, show these defaults:
1. "Your booking is confirmed! We look forward to seeing you."
2. "Thank you for your patience. We're ready for your appointment!"
3. "We need to reschedule your appointment. What times work for you?"

## Testing Checklist

- [ ] Edit button opens Quick Reply Manager modal
- [ ] Shop can create a new quick reply
- [ ] Shop can edit an existing quick reply
- [ ] Shop can delete a quick reply
- [ ] Quick replies list updates after create/edit/delete
- [ ] Clicking a quick reply sends it as a real message
- [ ] Usage count increments on send
- [ ] Quick replies sorted by usage count (most used first)
- [ ] Shop can only see their own quick replies
- [ ] Default fallback replies shown when shop has none

## Effort

~2-3 hours (backend + frontend)

## Related

- Parent strategy: `docs/tasks/strategy/shop-auto-responses-scheduled-messages.md` (Feature A)
- Depends on: `docs/tasks/strategy/messaging-gaps-websocket-unread-buttons.md` (completed — booking panel now uses real messaging)
