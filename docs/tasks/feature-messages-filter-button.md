# FEATURE: Messages Filter Button (Unread & Date Range)

**Status:** Complete
**Priority:** Low
**Type:** Feature (Shop Dashboard Enhancement)
**Created:** 2026-03-11

## Description

The "Filter" button in the shop Messages tab (`MessagesTab.tsx` line 217) is **static with no onClick handler**. Clicking it does nothing.

### Existing Filtering (MessageInbox)

`MessageInbox.tsx` already has built-in filters inside the conversation list panel:
- **Search bar** — filters by participant name, service name, or message content
- **Status tabs** — All / Active / Resolved

These work at the inbox level and filter the conversation list directly.

### What's Missing

The top-level Filter button in `MessagesTab` should provide **additional filtering** that the inbox doesn't cover:
- **Unread only** — show only conversations with unread messages
- **Date range** — filter conversations by last activity date

## Implementation Plan

### Step 1: Add filter state and dropdown

**File:** `frontend/src/components/shop/tabs/MessagesTab.tsx`

Add state for the filter dropdown and active filters:

```typescript
const [showFilterDropdown, setShowFilterDropdown] = useState(false);
const [filterUnread, setFilterUnread] = useState(false);
const [filterDateRange, setFilterDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
```

### Step 2: Create filter dropdown UI

Render a dropdown below the Filter button when clicked:

```
┌──────────────────────┐
│ ☐ Unread only        │
│ ─────────────────    │
│ Date Range:          │
│ ● All time           │
│ ○ Last 7 days        │
│ ○ Last 30 days       │
│ ○ Last 90 days       │
│ ─────────────────    │
│ [Clear]  [Apply]     │
└──────────────────────┘
```

- Checkbox for "Unread only"
- Radio group for date range
- Clear button resets all filters
- Apply button closes dropdown
- Click-outside dismisses dropdown

### Step 3: Pass filters to MessagesContainer → MessageInbox

**Option A (Simple):** Filter conversations at the `MessagesTab` level before they reach the inbox. This requires lifting conversation data up from `MessagesContainer`.

**Option B (Recommended):** Pass filter props down to `MessagesContainer` → `MessageInbox`, and let the inbox apply the additional filters alongside its existing search + status filters.

Add props to `MessagesContainer`:

```typescript
interface MessagesContainerProps {
  userType: "customer" | "shop";
  currentUserId: string;
  initialConversationId?: string | null;
  filterUnread?: boolean;
  filterDateRange?: 'all' | '7d' | '30d' | '90d';
}
```

Then in `MessagesContainer`, apply filters when transforming conversations:

```typescript
let filtered = transformedConversations;
if (filterUnread) {
  filtered = filtered.filter(c => c.unreadCount > 0);
}
if (filterDateRange !== 'all') {
  const days = filterDateRange === '7d' ? 7 : filterDateRange === '30d' ? 30 : 90;
  const cutoff = new Date(Date.now() - days * 86400000);
  filtered = filtered.filter(c => new Date(c.lastMessageTime) >= cutoff);
}
```

### Step 4: Visual indicator for active filters

When filters are active, show a badge on the Filter button:

```typescript
const hasActiveFilters = filterUnread || filterDateRange !== 'all';

<button className="... relative">
  <Filter className="w-4 h-4" />
  Filter
  {hasActiveFilters && (
    <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#FFCC00] rounded-full" />
  )}
</button>
```

## Files to Modify

| File | Action |
| ---- | ------ |
| `frontend/src/components/shop/tabs/MessagesTab.tsx` | Add filter state, dropdown UI, pass props down |
| `frontend/src/components/messaging/MessagesContainer.tsx` | Accept filter props, apply to conversation list |

## Edge Cases

- **Click-outside dismissal:** Close dropdown when clicking outside (useRef + useEffect pattern)
- **No results:** If filters hide all conversations, the inbox already shows "No conversations" state
- **Filter + Search:** Filters should stack with the inbox's existing search and status tabs
- **URL state:** Filters are session-only (not persisted in URL or storage)
- **Active filter indicator:** Yellow dot on Filter button when filters are applied

## Effort

~1 hour
