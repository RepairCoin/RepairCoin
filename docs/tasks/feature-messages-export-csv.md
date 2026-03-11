# FEATURE: Export Messages/Conversations to CSV

**Status:** Complete
**Priority:** Low
**Type:** Feature (Shop Dashboard Enhancement)
**Created:** 2026-03-11

## Description

The "Export" button in the shop Messages tab (`MessagesTab.tsx` line 194) is **static with no onClick handler**. Clicking it does nothing. It should export the shop's conversation data as a CSV file download.

## Current State

- **Button location:** `frontend/src/components/shop/tabs/MessagesTab.tsx` (line 194-197)
- **Button is static:** No `onClick`, no function
- **Data already loaded:** `fetchStats()` at line 38 already calls `messagingApi.getConversations()` and has all conversation data
- **Existing pattern:** `admin/tabs/TransactionsTab.tsx` lines 105-129 has a working `exportToCSV()` that generates CSV and triggers download via blob URL

## Implementation Plan

### Step 1: Store conversations data in state

**File:** `frontend/src/components/shop/tabs/MessagesTab.tsx`

The `fetchStats` useEffect already fetches conversations but only stores derived stats. Store the raw conversations too:

```typescript
const [conversations, setConversations] = useState<messagingApi.Conversation[]>([]);

// Inside fetchStats:
setConversations(conversations);
```

### Step 2: Add exportToCSV function

Reuse the pattern from `TransactionsTab.tsx`:

```typescript
const exportToCSV = () => {
  if (conversations.length === 0) return;

  const headers = ['Customer', 'Last Message', 'Last Activity', 'Unread Messages', 'Status', 'Created'];
  const rows = conversations.map(conv => [
    `"${(conv.customerName || conv.customerAddress || '').replace(/"/g, '""')}"`,
    `"${(conv.lastMessagePreview || '').replace(/"/g, '""')}"`,
    conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : '-',
    conv.unreadCountShop,
    conv.isBlocked ? 'Blocked' : conv.isArchivedShop ? 'Archived' : 'Active',
    new Date(conv.createdAt).toLocaleString(),
  ]);

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversations_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
```

### Step 3: Wire onClick to Export button

```typescript
<button onClick={exportToCSV} className="...">
  <Download className="w-4 h-4" />
  Export
</button>
```

## Files to Modify

| File | Action |
| ---- | ------ |
| `frontend/src/components/shop/tabs/MessagesTab.tsx` | Add `conversations` state, `exportToCSV` function, wire `onClick` |

## CSV Output Columns

| Column | Source |
| ------ | ------ |
| Customer | `customerName` or `customerAddress` |
| Last Message | `lastMessagePreview` |
| Last Activity | `lastMessageAt` |
| Unread Messages | `unreadCountShop` |
| Status | Derived from `isBlocked` / `isArchivedShop` |
| Created | `createdAt` |

## Edge Cases

- **No conversations:** Disable button or show toast "No conversations to export"
- **Special characters in messages:** Wrap fields in quotes, escape inner quotes with `""`
- **Large datasets:** Current fetch is limited to 100 conversations — sufficient for MVP
- **Filename:** `conversations_YYYY-MM-DD.csv` with today's date

## Effort

~15 minutes
