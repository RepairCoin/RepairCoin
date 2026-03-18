# Feature: Messaging Additional Filters

**Status:** Open
**Priority:** LOW
**Est. Effort:** 1-2 hours
**Created:** 2026-03-13

---

## Problem

Shops need more ways to filter conversations beyond Active/Archived:
- Unread conversations (need attention)
- Recent conversations (last 7/30 days)
- Conversations with upcoming bookings

## Current State

- Only Active/Archived filter exists
- No way to see "unread only"
- No date-based filtering

## Implementation

### Phase 1: Unread Filter

#### Backend Changes

Add `unread` query parameter:

```typescript
// MessageController.ts
const unreadOnly = req.query.unread === 'true';

// MessageRepository.ts
if (unreadOnly) {
  const unreadColumn = userType === 'customer' ? 'unread_count_customer' : 'unread_count_shop';
  whereClause += ` AND c.${unreadColumn} > 0`;
}
```

#### Mobile Changes

Add filter chip/toggle:

```tsx
<View className="flex-row px-4 py-2 gap-2">
  <Pressable
    onPress={() => setUnreadOnly(!unreadOnly)}
    className={`px-3 py-1.5 rounded-full ${
      unreadOnly ? "bg-[#FFCC00]" : "bg-zinc-800"
    }`}
  >
    <Text className={unreadOnly ? "text-black" : "text-zinc-400"}>
      Unread only
    </Text>
  </Pressable>
</View>
```

### Phase 2: Date Filters (Optional)

Add dropdown for time range:
- All time (default)
- Last 7 days
- Last 30 days
- Last 90 days

```typescript
// Backend
const daysFilter = req.query.days ? parseInt(req.query.days as string) : null;

if (daysFilter) {
  whereClause += ` AND c.last_message_at >= NOW() - INTERVAL '${daysFilter} days'`;
}
```

### Phase 3: Booking Filter (Future)

Filter conversations where customer has booking today/this week:
- Requires JOIN with service_orders table
- More complex query

## Files to Modify

**Backend:**
- `backend/src/repositories/MessageRepository.ts`
- `backend/src/domains/messaging/controllers/MessageController.ts`

**Mobile:**
- `mobile/feature/messages/services/message.services.ts`
- `mobile/feature/messages/hooks/ui/useMessages.ts`
- `mobile/feature/messages/screens/MessagesScreen.tsx`

## UI Design

```
┌─────────────────────────────────────┐
│  [Active] [Archived]                │  <- Existing tabs
├─────────────────────────────────────┤
│  [Unread only] [Last 7 days ▼]      │  <- New filter chips
├─────────────────────────────────────┤
│  Conversations list...              │
└─────────────────────────────────────┘
```

## Verification Checklist

### Phase 1
- [ ] "Unread only" toggle works
- [ ] Shows only conversations with unread > 0
- [ ] Toggle persists during session
- [ ] Works with Active/Archived tabs

### Phase 2
- [ ] Date filter dropdown works
- [ ] Filters by last_message_at
- [ ] Combines with other filters

### Phase 3
- [ ] "Has booking today" filter (future)
